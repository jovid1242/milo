import type { Repositories } from '@/data/repositories/types';
import { completeQuest, type QuestOutcome } from '@/features/progress/use-cases';
import type {
  Quest,
  QuestCompletion,
  Timestamp,
  VocabularyProgress,
  VocabularyQuest,
} from '@/schemas';

import {
  INITIAL_PROGRESS,
  progressFraction,
  restoreProgress,
  toAnswerRecords,
  vocabularyResult,
} from './logic/vocabulary-session';

/** Everything the Vocabulary screen needs to open a quest where the user left it. */
export type VocabularyQuestData = {
  quest: Quest;
  /** `null` while this day's words are not written yet. */
  content: VocabularyQuest | null;
  progress: VocabularyProgress;
  /** When the saved session began; `null` for a fresh start. */
  startedAt: Timestamp | null;
  /** Set once the quest was finished — XP is already earned then. */
  completion: QuestCompletion | null;
};

export async function loadVocabularyQuest(
  repositories: Repositories,
  questId: string,
): Promise<VocabularyQuestData> {
  const [plans, rawContent, sessions, completions] = await Promise.all([
    repositories.challenge.getDailyChallenges(),
    repositories.challenge.getQuestContent(questId),
    repositories.progress.getQuestSessions(),
    repositories.progress.getCompletions(),
  ]);
  const quest = plans.flatMap((plan) => plan.quests).find((item) => item.id === questId);
  if (!quest || quest.type !== 'vocabulary') throw new Error(`Not a vocabulary quest: ${questId}`);

  const content = rawContent?.type === 'vocabulary' ? rawContent : null;
  const session = sessions.find((item) => item.questId === questId) ?? null;
  return {
    quest,
    content,
    progress: content && session ? restoreProgress(content, session.state) : INITIAL_PROGRESS,
    startedAt: session?.startedAt ?? null,
    completion: completions.find((item) => item.questId === questId) ?? null,
  };
}

/** Saves where the user is; the session is what Home shows as "in progress". */
export async function saveVocabularyProgress(
  repositories: Repositories,
  input: {
    content: VocabularyQuest;
    progress: VocabularyProgress;
    startedAt: Timestamp;
    now?: Date;
  },
): Promise<void> {
  await repositories.progress.saveQuestSession({
    questId: input.content.questId,
    startedAt: input.startedAt,
    updatedAt: (input.now ?? new Date()).toISOString(),
    progress: progressFraction(input.content, input.progress),
    state: input.progress,
  });
}

/** Finishes the quest through the shared completion use case (XP once, achievements, day). */
export async function completeVocabularyQuest(
  repositories: Repositories,
  input: { content: VocabularyQuest; progress: VocabularyProgress; now?: Date },
): Promise<QuestOutcome> {
  const result = vocabularyResult(input.content, input.progress);
  return completeQuest(repositories, {
    questId: input.content.questId,
    correctCount: result.correctCount,
    totalCount: result.total,
    answers: toAnswerRecords(input.content.questId, input.progress.answers),
    now: input.now,
  });
}
