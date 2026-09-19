import type { Repositories } from '@/data/repositories/types';
import { getChallengeDay } from '@/features/challenge/logic/calendar';
import { findCompletedDays } from '@/features/progress/logic/day-completion';
import type {
  AchievementUnlock,
  DailyChallenge,
  DayCompletion,
  DayNumber,
  JoinTeamResult,
  QuestCompletion,
  TeamActivity,
  TeamInvite,
} from '@/schemas';

import {
  buildTeamView,
  fromTeamMember,
  teamStreakOf,
  type MemberProgress,
  type MemberView,
  type TeamView,
} from './logic/team';

/** The current user's own id in the team; their data always comes from local progress. */
export const ME = 'me';

const STREAK_MILESTONES = new Set([3, 7, 14, 30, 50, 90]);

/** The current user as a team member, built from their local progress. */
function myProgress(input: {
  displayName: string;
  plans: readonly DailyChallenge[];
  completions: readonly QuestCompletion[];
  totalXp: number;
  achievementsUnlocked: number;
  currentDay: DayNumber;
}): MemberProgress {
  const today = input.plans.find((plan) => plan.day === input.currentDay);
  const done = new Set(input.completions.map((completion) => completion.questId));
  const last = input.completions
    .map((completion) => completion.completedAt)
    .sort()
    .at(-1);
  return {
    id: ME,
    displayName: input.displayName,
    avatarUrl: null,
    isCurrentUser: true,
    joinedDay: 1,
    completedDays: findCompletedDays(input.plans, input.completions),
    todayQuestsDone: today?.quests.filter((quest) => done.has(quest.id)).length ?? 0,
    totalXp: input.totalXp,
    achievementsUnlocked: input.achievementsUnlocked,
    lastActivityAt: last ?? null,
  };
}

/** The team as the Friends screen shows it; `null` while the user has no team. */
export async function loadTeamView(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<TeamView | null> {
  const team = await repositories.friends.getMyTeam();
  if (!team) return null;
  const [user, plans, completions, totalXp, unlocks, others] = await Promise.all([
    repositories.user.getUser(),
    repositories.challenge.getDailyChallenges(),
    repositories.progress.getCompletions(),
    repositories.progress.getTotalXp(),
    repositories.achievements.getUnlocks(),
    repositories.friends.getTeamMembers(),
  ]);
  const currentDay = getChallengeDay(user.challengeStartDate, now);
  const questCount = plans.find((plan) => plan.day === currentDay)?.quests.length ?? 0;
  return buildTeamView({
    team,
    currentDay,
    questCount,
    me: myProgress({
      displayName: user.displayName,
      plans,
      completions,
      totalXp,
      achievementsUnlocked: unlocks.length,
      currentDay,
    }),
    others: others.map((member) => fromTeamMember(member, currentDay)),
  });
}

/** One member, as the team view sees them. */
export async function loadMemberDetails(
  repositories: Repositories,
  memberId: string,
  now: Date = new Date(),
): Promise<{ member: MemberView; team: TeamView } | null> {
  const team = await loadTeamView(repositories, now);
  const member = team?.members.find((item) => item.id === memberId);
  return team && member ? { member, team } : null;
}

/**
 * Team streak facts for the achievement engine — from the same domain logic
 * the Friends screen uses. `null` without a team, or while the user is alone in it.
 */
export async function loadTeamStreakFacts(
  repositories: Repositories,
  input: { completedDays: ReadonlySet<DayNumber>; currentDay: DayNumber },
): Promise<{ current: number; longest: number } | null> {
  const team = await repositories.friends.getMyTeam();
  if (!team) return null;
  const others = await repositories.friends.getTeamMembers();
  return teamStreakOf(
    [
      { joinedDay: 1, completedDays: input.completedDays },
      ...others.map((member) => fromTeamMember(member, input.currentDay)),
    ],
    input.currentDay,
  );
}

/** The user's own events, derived from their progress — nothing is stored twice. */
function myActivity(
  days: readonly DayCompletion[],
  unlocks: readonly AchievementUnlock[],
): TeamActivity[] {
  const events: TeamActivity[] = [];
  for (const record of days) {
    events.push({
      id: `me-day-${record.day}`,
      memberId: ME,
      type: 'dayCompleted',
      metadata: { day: record.day },
      createdAt: record.completedAt,
    });
    if (STREAK_MILESTONES.has(record.streakAfter)) {
      events.push({
        id: `me-streak-${record.streakAfter}-${record.day}`,
        memberId: ME,
        type: 'streakMilestone',
        metadata: { days: record.streakAfter },
        createdAt: record.completedAt,
      });
    }
  }
  for (const unlock of unlocks) {
    events.push({
      id: `me-badge-${unlock.achievementId}`,
      memberId: ME,
      type: 'achievementUnlocked',
      metadata: { achievementId: unlock.achievementId },
      createdAt: unlock.unlockedAt,
    });
  }
  return events;
}

/**
 * A few recent moments of the team — not a feed. Newest first, at most
 * `perMember` from each person, so one busy member never fills the list.
 */
export function pickTeamActivity(
  events: readonly TeamActivity[],
  { limit, perMember }: { limit: number; perMember: number },
): TeamActivity[] {
  const newest = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const taken = new Map<string, number>();
  const picked: TeamActivity[] = [];
  for (const event of newest) {
    const count = taken.get(event.memberId) ?? 0;
    if (count >= perMember) continue;
    taken.set(event.memberId, count + 1);
    picked.push(event);
    if (picked.length === limit) break;
  }
  return picked;
}

export async function loadTeamActivity(
  repositories: Repositories,
  limit = 5,
): Promise<TeamActivity[]> {
  const team = await repositories.friends.getMyTeam();
  if (!team) return [];
  const [theirs, days, unlocks] = await Promise.all([
    repositories.friends.getTeamActivity(limit * 4),
    repositories.progress.getDayCompletions(),
    repositories.achievements.getUnlocks(),
  ]);
  // Only what happened since the team exists: older history is not team news.
  const mine = myActivity(days, unlocks).filter((event) => event.createdAt >= team.createdAt);
  return pickTeamActivity([...mine, ...theirs], { limit, perMember: 2 });
}

export async function createInvite(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<TeamInvite> {
  return repositories.friends.createInvite(now.toISOString());
}

export async function joinTeam(repositories: Repositories, code: string): Promise<JoinTeamResult> {
  return repositories.friends.joinTeam(code);
}
