import type { Repositories } from '@/data/repositories/types';
import { completeQuest, type QuestOutcome } from '@/features/progress/use-cases';
import type { ChoiceAnswer, Quest, QuestCompletion, QuestContent, Timestamp } from '@/schemas';

import { scorePractice, toAnswerRecords } from './logic/practice';

/**
 * Everything needed to open any quest where the user left it. The saved
 * position is kept as-is: each quest type validates its own shape.
 */
export type QuestRun = {
  quest: Quest;
  /** The day's final quest: finishing it finishes the day. */
  isLastOfDay: boolean;
  /** `null` while the day's content is not written yet. */
  content: QuestContent | null;
  /** Content of the quests this one builds on — the Review's sources. */
  sources: QuestContent[];
  savedState: unknown;
  /** When the saved session began; `null` for a fresh start. */
  startedAt: Timestamp | null;
  /** Set once the quest was finished — its XP is already earned then. */
  completion: QuestCompletion | null;
};

export async function loadQuestRun(repositories: Repositories, questId: string): Promise<QuestRun> {
  const [plans, content, sessions, completions] = await Promise.all([
    repositories.challenge.getDailyChallenges(),
    repositories.challenge.getQuestContent(questId),
    repositories.progress.getQuestSessions(),
    repositories.progress.getCompletions(),
  ]);
  const plan = plans.find((item) => item.quests.some((candidate) => candidate.id === questId));
  const quest = plan?.quests.find((item) => item.id === questId);
  if (!plan || !quest) throw new Error(`Unknown quest: ${questId}`);

  const own = content?.type === quest.type ? content : null;
  const sourceIds = own?.type === 'review' ? Object.values(own.sources) : [];
  const sources = await Promise.all(
    sourceIds.map((id) => (id ? repositories.challenge.getQuestContent(id) : null)),
  );

  const session = sessions.find((item) => item.questId === questId) ?? null;
  return {
    quest,
    isLastOfDay: plan.quests.at(-1)?.id === quest.id,
    content: own,
    sources: sources.filter((item): item is QuestContent => item !== null),
    savedState: session?.state ?? null,
    startedAt: session?.startedAt ?? null,
    completion: completions.find((item) => item.questId === questId) ?? null,
  };
}

/** Saves where the user is; the session is also what Home shows as "in progress". */
export async function saveQuestRun(
  repositories: Repositories,
  input: {
    questId: string;
    startedAt: Timestamp;
    /** Share of the quest done, 0…1. */
    progress: number;
    state: unknown;
    now?: Date;
  },
): Promise<void> {
  await repositories.progress.saveQuestSession({
    questId: input.questId,
    startedAt: input.startedAt,
    updatedAt: (input.now ?? new Date()).toISOString(),
    progress: Math.min(1, Math.max(0, input.progress)),
    // Stored as JSON: a plain copy of the quest's (already validated) state.
    state: JSON.parse(JSON.stringify(input.state)),
  });
}

/**
 * Finishes a quest from its practice answers through the shared completion
 * use case: XP once per quest, achievements, the day, the streak.
 */
export async function finishQuestRun(
  repositories: Repositories,
  input: {
    questId: string;
    answers: readonly ChoiceAnswer[];
    exerciseCount: number;
    now?: Date;
  },
): Promise<QuestOutcome> {
  const score = scorePractice(input.answers, input.exerciseCount);
  return completeQuest(repositories, {
    questId: input.questId,
    correctCount: score.correctCount,
    totalCount: score.total,
    answers: toAnswerRecords(input.questId, input.answers),
    now: input.now,
  });
}
