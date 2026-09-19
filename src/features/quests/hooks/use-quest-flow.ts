import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';

import { CHALLENGE } from '@/constants/challenge';
import { useRepositories } from '@/data/repository-provider';
import { invalidateProgress } from '@/features/progress/queries';
import type { QuestOutcome } from '@/features/progress/use-cases';
import { logger } from '@/lib/logger';
import type { ChoiceAnswer, Timestamp } from '@/schemas';
import { playFeedback } from '@/services/feedback';

import { markQuestCelebrated } from '../celebrations';
import { scorePractice, type PracticeScore } from '../logic/practice';
import { finishQuestRun, saveQuestRun } from '../use-cases';

/** `play` earns the quest; `replay` practises a finished quest without saving. */
export type RunMode = 'play' | 'replay';

/** Where a run is: the intro is not saved yet, the result finishes the quest. */
export type RunStage = 'intro' | 'playing' | 'result';

export type RunResult = PracticeScore & {
  /** `null` until the completion is saved. */
  xpEarned: number | null;
  perfectBonus: number;
  firstCompletion: boolean;
};

export type QuestFlowConfig<State> = {
  questId: string;
  mode: RunMode;
  savedStartedAt: Timestamp | null;
  exerciseCount: number;
  stageOf: (state: State) => RunStage;
  /** Share of the quest done, 0…1 — shown on Home while in progress. */
  progressOf: (state: State) => number;
  answersOf: (state: State) => readonly ChoiceAnswer[];
  /**
   * A perfect run gets its own sound (default). The Review turns it off: the
   * day's celebration follows right after, and moments never stack.
   */
  perfectMoment?: boolean;
};

/** Repository writes in order: a save can never land after the completion. */
export function createWriteQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const next = tail.then(task);
      tail = next.catch((error: unknown) => logger.warn('quest progress write failed', error));
      return next;
    },
    idle: () => tail,
  };
}

/** The sound and haptic for an answer — the same in every quest. */
export function playAnswerFeedback(correct: boolean): void {
  playFeedback(correct ? 'correct' : 'wrong');
}

/**
 * Runs one quest: owns its state through the quest type's reducer, saves the
 * position after every step, and finishes the quest once — one sound for the
 * moment, XP through the shared completion use case, Home refreshed.
 */
export function useQuestFlow<State, Action>(
  reducer: (state: State, action: Action) => State,
  initial: State,
  config: QuestFlowConfig<State>,
) {
  const { questId, mode, exerciseCount, stageOf, progressOf, answersOf } = config;
  const perfectMoment = config.perfectMoment ?? true;
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initial);
  const [startedAt] = useState(() => config.savedStartedAt ?? new Date().toISOString());
  const [queue] = useState(createWriteQueue);
  const [outcome, setOutcome] = useState<QuestOutcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const finished = useRef(false);
  const stage = stageOf(state);

  const save = useEffectEvent((current: State) => {
    void queue.run(() =>
      saveQuestRun(repositories, {
        questId,
        startedAt,
        progress: progressOf(current),
        state: current,
      }),
    );
  });

  // Saved after every step — each user action changes the state exactly once.
  useEffect(() => {
    if (mode === 'replay' || stage !== 'playing') return;
    save(state);
  }, [state, stage, mode]);

  const complete = () => {
    queue
      .run(() =>
        finishQuestRun(repositories, { questId, answers: answersOf(state), exerciseCount }),
      )
      .then((result) => {
        if (result.isFirstCompletion) markQuestCelebrated(questId);
        setOutcome(result);
        invalidateProgress(queryClient);
      })
      .catch((error: unknown) => {
        logger.error('could not save the quest result', error);
        setSaveFailed(true);
      });
  };

  const finish = useEffectEvent(() => {
    // One sound for the moment: never stacked with others.
    const { isPerfect } = scorePractice(answersOf(state), exerciseCount);
    playFeedback(isPerfect && perfectMoment ? 'perfect' : 'questComplete');
    if (mode === 'play') complete();
  });

  // The result is reached once — also when a quest is reopened at its result.
  useEffect(() => {
    if (stage !== 'result' || finished.current) return;
    finished.current = true;
    finish();
  }, [stage]);

  let result: RunResult | null = null;
  if (stage === 'result') {
    const score = scorePractice(answersOf(state), exerciseCount);
    const firstCompletion = mode === 'play' && (outcome?.isFirstCompletion ?? true);
    result = {
      ...score,
      xpEarned: mode === 'replay' ? 0 : (outcome?.xpEarned ?? null),
      perfectBonus: score.isPerfect && firstCompletion ? CHALLENGE.perfectScoreBonusXp : 0,
      firstCompletion,
    };
  }

  return {
    state,
    dispatch,
    stage,
    result,
    /** What finishing the quest changed (XP, the day, the streak) once it is saved. */
    outcome,
    saveFailed,
    retrySave: () => {
      setSaveFailed(false);
      complete();
    },
    /** Resolves once every pending save has reached storage. */
    flush: () => queue.idle(),
  };
}
