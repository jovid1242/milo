import type { Repositories } from '@/data/repositories/types';
import { toLocalDate } from '@/lib/dates';
import { deviceTimeZone } from '@/lib/time-zone';
import { DisplayNameSchema, GoalSchema, type Goal, type User } from '@/schemas';

export type StartChallengeInput = {
  displayName: string;
  goal: Goal;
};

/**
 * Starts the 90-day challenge on this device: the profile takes the name and
 * goal, Day 1 becomes today, and onboarding is over. Everything else the app
 * counts — completed days, streak, XP, Chapter 01 — follows from an empty
 * history and needs no rows of its own.
 *
 * The write is idempotent: a profile that is already onboarded comes back
 * untouched, so a double tap, a retry after an error or a second launch can
 * never restart the challenge or move Day 1.
 */
export async function startChallenge(
  repositories: Repositories,
  input: StartChallengeInput,
  now: Date = new Date(),
): Promise<User> {
  const challengeStartDate = toLocalDate(now);
  // With an account, the server starts it too: on this date, in this time zone.
  const mutation = repositories.sync
    ? repositories.sync.mutation(
        'startChallenge',
        {
          courseId: (await repositories.course.getCourse()).id,
          startDate: challengeStartDate,
          timeZone: deviceTimeZone(),
        },
        now,
      )
    : null;
  const user = await repositories.user.completeOnboarding(
    {
      displayName: DisplayNameSchema.parse(input.displayName),
      goal: GoalSchema.parse(input.goal),
      challengeStartDate,
      onboardedAt: now.toISOString(),
    },
    mutation,
  );
  repositories.sync?.requestSync('mutation');
  return user;
}

/** Whether the app should show onboarding instead of the challenge. */
export function needsOnboarding(user: Pick<User, 'onboardedAt'>): boolean {
  return user.onboardedAt === null;
}
