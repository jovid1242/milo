import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';

import { useRepositories } from '@/data/repository-provider';
import { invalidateProgress } from '@/features/progress/queries';
import type { QuestOutcome } from '@/features/progress/use-cases';
import { markQuestCelebrated } from '@/features/quests/celebrations';
import { logger } from '@/lib/logger';
import type { Achievement, Timestamp, VocabularyProgress, VocabularyQuest } from '@/schemas';
import { playFeedback } from '@/services/feedback';

import {
  answerFor,
  currentExercise,
  reduceVocabulary,
  vocabularyResult,
  type VocabularyAction,
} from '../logic/vocabulary-session';
import { completeVocabularyQuest, saveVocabularyProgress } from '../use-cases';

/** `play` earns the quest; `replay` practises a finished quest without saving. */
export type FlowMode = 'play' | 'replay';

export type ResultSummary = {
  correctCount: number;
  total: number;
  isPerfect: boolean;
  wordsLearned: string[];
  /** `null` until the completion is saved. */
  xpEarned: number | null;
  perfectBonus: number;
  firstCompletion: boolean;
  newAchievements: Achievement[];
};

/** Repository writes in order: a save can never land after the completion. */
function createWriteQueue() {
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

export function useVocabularyFlow({
  content,
  initial,
  savedStartedAt,
  mode,
  perfectBonusXp,
}: {
  content: VocabularyQuest;
  initial: VocabularyProgress;
  savedStartedAt: Timestamp | null;
  mode: FlowMode;
  perfectBonusXp: number;
}) {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(
    (current: VocabularyProgress, action: VocabularyAction) =>
      reduceVocabulary(content, current, action),
    initial,
  );
  const [startedAt] = useState(() => savedStartedAt ?? new Date().toISOString());
  const [queue] = useState(createWriteQueue);
  const [outcome, setOutcome] = useState<QuestOutcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const finishing = useRef(false);

  // Saved after every step — each user action changes the state exactly once.
  useEffect(() => {
    if (mode === 'replay' || state.phase === 'intro' || state.phase === 'result') return;
    void queue.run(() =>
      saveVocabularyProgress(repositories, { content, progress: state, startedAt }),
    );
  }, [state, mode, queue, repositories, content, startedAt]);

  const complete = () => {
    queue
      .run(() => completeVocabularyQuest(repositories, { content, progress: state }))
      .then((result) => {
        if (result.isFirstCompletion) markQuestCelebrated(content.questId);
        setOutcome(result);
        invalidateProgress(queryClient);
      })
      .catch((error: unknown) => {
        logger.error('could not save the vocabulary result', error);
        setSaveFailed(true);
      });
  };

  const finish = useEffectEvent(() => {
    // One sound for the moment: never stacked with others.
    playFeedback(vocabularyResult(content, state).isPerfect ? 'perfect' : 'questComplete');
    if (mode === 'play') complete();
  });

  // The result is reached once — also when a quest is reopened at its result.
  useEffect(() => {
    if (state.phase !== 'result' || finishing.current) return;
    finishing.current = true;
    finish();
  }, [state.phase]);

  const answer = (optionItemId: string) => {
    const exercise = currentExercise(content, state);
    if (!exercise || answerFor(state, exercise.id)) return;
    playFeedback(optionItemId === exercise.itemId ? 'correct' : 'wrong');
    dispatch({ type: 'answer', optionItemId, at: new Date().toISOString() });
  };

  let summary: ResultSummary | null = null;
  if (state.phase === 'result') {
    const result = vocabularyResult(content, state);
    const firstCompletion = mode === 'play' && (outcome?.isFirstCompletion ?? true);
    summary = {
      ...result,
      xpEarned: mode === 'replay' ? 0 : (outcome?.xpEarned ?? null),
      perfectBonus: result.isPerfect && firstCompletion ? perfectBonusXp : 0,
      firstCompletion,
      newAchievements: outcome?.newAchievements ?? [],
    };
  }

  return {
    state,
    summary,
    saveFailed,
    retrySave: () => {
      setSaveFailed(false);
      complete();
    },
    start: () => dispatch({ type: 'start' }),
    reveal: () => dispatch({ type: 'reveal' }),
    learned: () => dispatch({ type: 'learned' }),
    answer,
    next: () => dispatch({ type: 'continue' }),
    /** Resolves once every pending save has reached storage. */
    flush: () => queue.idle(),
  };
}
