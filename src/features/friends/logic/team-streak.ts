import type { Friend } from '@/schemas';

/** A team streak lasts only as long as every member keeps theirs. */
export function computeTeamStreak(
  userStreak: number,
  friends: readonly Pick<Friend, 'streak'>[],
): number {
  if (friends.length === 0) return 0;
  return Math.min(userStreak, ...friends.map((friend) => friend.streak));
}
