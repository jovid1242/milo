import type { CachedTeam, Repositories } from '@/data/repositories/types';
import { getChallengeDay } from '@/features/challenge/logic/calendar';
import { findCompletedDays } from '@/features/progress/logic/day-completion';
import { computeStreak } from '@/features/progress/logic/streak';
import type { InviteCode, InvitePreview, TeamInvite, Timestamp } from '@/schemas';

import {
  buildTeamView,
  teamStreakFacts,
  type MemberView,
  type MyProgress,
  type TeamView,
} from './logic/team';

/**
 * The Friends tab as the device can show it right now — from the last answer
 * the server gave (kept per account) and the user's own progress. Asking the
 * server again is separate (`refreshTeam`), so the tab never waits for a
 * network to show what it knows.
 */
export type FriendsState =
  /** No answer yet on this device: the first one is on its way (or needs a connection). */
  | { kind: 'unknown'; serverBacked: boolean }
  | { kind: 'noTeam'; serverBacked: boolean; asOf: Timestamp }
  | { kind: 'team'; serverBacked: boolean; view: TeamView };

/** The user's own progress, as this device has it. */
async function myProgress(repositories: Repositories, now: Date): Promise<MyProgress> {
  const [user, plans, completions, totalXp, unlocks] = await Promise.all([
    repositories.user.getUser(),
    repositories.course.getDays(),
    repositories.progress.getCompletions(),
    repositories.progress.getTotalXp(),
    repositories.achievements.getUnlocks(),
  ]);
  const currentDay = getChallengeDay(user.challengeStartDate, now);
  const completedDays = findCompletedDays(plans, completions);
  const today = completions.filter((completion) => completion.day === currentDay);
  const last = completions
    .map((completion) => completion.completedAt)
    .sort()
    .at(-1);
  return {
    currentDay,
    completedDays,
    todayQuestsDone: today.length,
    streak: computeStreak(completedDays, currentDay),
    totalXp,
    achievementsUnlocked: unlocks.length,
    lastActivityAt: last ?? null,
  };
}

async function stateOf(
  repositories: Repositories,
  cached: CachedTeam | null,
  now: Date,
): Promise<FriendsState> {
  const { serverBacked, selfId } = repositories.friends;
  if (!cached) return { kind: 'unknown', serverBacked };
  if (!cached.team) return { kind: 'noTeam', serverBacked, asOf: cached.asOf };
  const [me, plans] = await Promise.all([
    myProgress(repositories, now),
    repositories.course.getDays(),
  ]);
  return {
    kind: 'team',
    serverBacked,
    view: buildTeamView({ team: cached.team, asOf: cached.asOf, selfId, me, plans, now }),
  };
}

/** What the Friends tab shows now, from this device alone. */
export async function loadFriends(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<FriendsState> {
  return stateOf(repositories, await repositories.friends.cached(), now);
}

/** One teammate, as the team view sees them. */
export async function loadMemberDetails(
  repositories: Repositories,
  userId: string,
  now: Date = new Date(),
): Promise<{ member: MemberView; team: TeamView } | null> {
  const state = await loadFriends(repositories, now);
  if (state.kind !== 'team') return null;
  const member = state.view.members.find((item) => item.userId === userId);
  return member ? { member, team: state.view } : null;
}

/**
 * The team streak for the badges' progress — the server's numbers. Only the
 * server unlocks the badge; `null` without a team of two or more.
 */
export async function loadTeamStreakFacts(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<{ current: number; longest: number } | null> {
  const state = await loadFriends(repositories, now);
  return teamStreakFacts(state.kind === 'team' ? state.view : null);
}

/** Asks the server for the team; the answer is kept for offline. */
export async function refreshTeam(repositories: Repositories): Promise<CachedTeam> {
  return repositories.friends.refresh();
}

/** A new team, with the user as its owner. Needs the server. */
export async function createTeam(repositories: Repositories): Promise<CachedTeam> {
  return repositories.friends.create();
}

/** The team's invite to share: the open one, or a new one. Needs the server. */
export async function teamInvite(repositories: Repositories, teamId: string): Promise<TeamInvite> {
  return repositories.friends.invite(teamId);
}

/** Turns the invite off and makes a new one: a code shared too widely stops working. */
export async function renewInvite(
  repositories: Repositories,
  input: { teamId: string; inviteId: string },
): Promise<TeamInvite> {
  await repositories.friends.revokeInvite(input.inviteId);
  return repositories.friends.invite(input.teamId);
}

/** The team behind a code — before joining it, and without anyone's progress. */
export async function previewInvite(
  repositories: Repositories,
  code: InviteCode,
): Promise<InvitePreview> {
  return repositories.friends.preview(code);
}

/** Joins the team behind a code: only ever on the user's say-so. */
export async function joinTeam(repositories: Repositories, code: InviteCode): Promise<CachedTeam> {
  return repositories.friends.join(code);
}

export async function leaveTeam(repositories: Repositories, teamId: string): Promise<CachedTeam> {
  return repositories.friends.leave(teamId);
}
