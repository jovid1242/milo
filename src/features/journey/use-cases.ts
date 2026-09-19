import type { Repositories } from '@/data/repositories/types';
import { getChallengeDay } from '@/features/challenge/logic/calendar';
import type { Journey } from '@/schemas';

import { buildJourney } from './logic/journey';

/** Reads the challenge state the map shows; nothing here is Journey-specific storage. */
export async function loadJourney(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<Journey> {
  const [user, plans, chapters, completions, dayCompletions] = await Promise.all([
    repositories.user.getUser(),
    repositories.challenge.getDailyChallenges(),
    repositories.challenge.getChapters(),
    repositories.progress.getCompletions(),
    repositories.progress.getDayCompletions(),
  ]);
  return buildJourney({
    plans,
    chapters,
    completions,
    dayCompletions,
    currentDay: getChallengeDay(user.challengeStartDate, now),
  });
}
