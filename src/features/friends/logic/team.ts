import { longestRun } from '@/features/achievements/logic/run';
import { computeStreak } from '@/features/progress/logic/streak';
import type { DayNumber, Team, TeamMember, Timestamp } from '@/schemas';

/** A member as the team view needs them: the current user comes from local progress. */
export type MemberProgress = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
  joinedDay: DayNumber;
  completedDays: ReadonlySet<DayNumber>;
  /** Quests done today; `null` when the member does not share it. */
  todayQuestsDone: number | null;
  totalXp: number | null;
  achievementsUnlocked: number | null;
  lastActivityAt: Timestamp | null;
};

/** Presentation state, derived — never stored. */
export type MemberTodayStatus = 'done' | 'almostThere' | 'inProgress' | 'notStarted' | 'unknown';

export type MemberView = MemberProgress & {
  status: MemberTodayStatus;
  /** Their own streak: finished days in a row, from their day history. */
  streak: number;
  /** Finished challenge days in total. */
  journeyDays: number;
};

export type TeamView = {
  team: Team;
  currentDay: DayNumber;
  /** Quests every member has today (one challenge, one plan). */
  questCount: number;
  /** The current user first, then in the order people joined — never a ranking. */
  members: MemberView[];
  finishedToday: number;
  /** Everyone finished today. */
  isTeamDayComplete: boolean;
  /** Days in a row that everyone finished, up to today (or yesterday). */
  teamStreak: number;
  longestTeamStreak: number;
};

/** A friend's shared data, as the team view uses it. */
export function fromTeamMember(member: TeamMember, currentDay: DayNumber): MemberProgress {
  return {
    id: member.id,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    isCurrentUser: false,
    joinedDay: member.joinedDay,
    completedDays: new Set(member.completedDays),
    // Progress shared for another day says nothing about today: 0 so far.
    todayQuestsDone:
      member.today === null ? null : member.today.day === currentDay ? member.today.questsDone : 0,
    totalXp: member.totalXp,
    achievementsUnlocked: member.achievementsUnlocked,
    lastActivityAt: member.lastActivityAt,
  };
}

export function memberTodayStatus(
  member: MemberProgress,
  currentDay: DayNumber,
  questCount: number,
): MemberTodayStatus {
  if (member.completedDays.has(currentDay)) return 'done';
  const done = member.todayQuestsDone;
  if (done === null) return 'unknown';
  if (done === 0) return 'notStarted';
  return done >= questCount - 1 ? 'almostThere' : 'inProgress';
}

/**
 * The team's days: a challenge day counts when the team had at least two
 * members that day and every one of them finished it. One missing member breaks
 * it — for the whole team, which is why the screens never name who. Days
 * someone spent alone, before anyone joined, are theirs, not the team's.
 */
export function teamDays(
  members: readonly Pick<MemberProgress, 'joinedDay' | 'completedDays'>[],
  currentDay: DayNumber,
): Set<DayNumber> {
  const days = new Set<DayNumber>();
  for (let day = 1; day <= currentDay; day++) {
    const required = members.filter((member) => member.joinedDay <= day);
    if (required.length >= 2 && required.every((member) => member.completedDays.has(day))) {
      days.add(day);
    }
  }
  return days;
}

/** Team streak now, and the longest one — `null` without anyone to share it with. */
export function teamStreakOf(
  members: readonly Pick<MemberProgress, 'joinedDay' | 'completedDays'>[],
  currentDay: DayNumber,
): { current: number; longest: number } | null {
  if (members.length < 2) return null;
  const days = teamDays(members, currentDay);
  return { current: computeStreak(days, currentDay), longest: longestRun(days) };
}

export function buildTeamView(input: {
  team: Team;
  me: MemberProgress;
  others: readonly MemberProgress[];
  currentDay: DayNumber;
  questCount: number;
}): TeamView {
  const { team, currentDay, questCount } = input;
  const ordered = [input.me, ...[...input.others].sort((a, b) => a.joinedDay - b.joinedDay)];
  const members = ordered.map((member): MemberView => ({
    ...member,
    status: memberTodayStatus(member, currentDay, questCount),
    streak: computeStreak(member.completedDays, currentDay),
    journeyDays: member.completedDays.size,
  }));
  const finishedToday = members.filter((member) => member.status === 'done').length;
  const streak = teamStreakOf(members, currentDay);
  return {
    team,
    currentDay,
    questCount,
    members,
    finishedToday,
    isTeamDayComplete: finishedToday === members.length,
    teamStreak: streak?.current ?? 0,
    longestTeamStreak: streak?.longest ?? 0,
  };
}
