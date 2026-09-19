import type { Repositories } from '@/data/repositories/types';
import { getChallengeDay } from '@/features/challenge/logic/calendar';
import type { Journey } from '@/schemas';

import { buildJourney } from './logic/journey';

/** Reads the challenge state the map shows; nothing here is Journey-specific storage. */
export async function loadJourney(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<Journey> {
  const [user, plans, chapters, completions, dayCompletions, examAttempts] = await Promise.all([
    repositories.user.getUser(),
    repositories.challenge.getDailyChallenges(),
    repositories.challenge.getChapters(),
    repositories.progress.getCompletions(),
    repositories.progress.getDayCompletions(),
    repositories.exams.getAllAttempts(),
  ]);
  const examQuests = plans.flatMap((plan) =>
    plan.quests.filter((quest) => quest.type === 'weeklyExam' || quest.type === 'finalBattle'),
  );
  const examContents = await Promise.all(
    examQuests.map((quest) => repositories.challenge.getQuestContent(quest.id)),
  );
  const examPassingScores = new Map(
    examContents.flatMap((content) =>
      content?.type === 'weeklyExam' || content?.type === 'finalBattle'
        ? [[content.questId, content.passingScore] as const]
        : [],
    ),
  );
  return buildJourney({
    plans,
    chapters,
    completions,
    dayCompletions,
    currentDay: getChallengeDay(user.challengeStartDate, now),
    examAttempts,
    examPassingScores,
  });
}
