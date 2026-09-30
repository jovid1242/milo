import { CHALLENGE } from '@/constants/challenge';
import { diffInCalendarDays, toLocalDate } from '@/lib/dates';
import type {
  CourseDay,
  DayNumber,
  TeamInvite,
  TeamMemberSummary,
  TeamSnapshot,
  Timestamp,
} from '@/schemas';

/**
 * The team as the Friends tab shows it: the server's snapshot, with the
 * user's own card from their local progress — so it moves the moment they
 * finish a quest, online or not. Everything here is derived; nothing is stored.
 */

/** Presentation state, derived — never stored. */
export type MemberTodayStatus = 'done' | 'almostThere' | 'inProgress' | 'notStarted';

/** The user's own progress, as their device has it now. */
export type MyProgress = {
  currentDay: DayNumber;
  completedDays: ReadonlySet<DayNumber>;
  todayQuestsDone: number;
  streak: number;
  totalXp: number;
  achievementsUnlocked: number;
  lastActivityAt: Timestamp | null;
};

export type MemberView = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
  isOwner: boolean;
  joinedAt: Timestamp;
  /** Their challenge day, on their own calendar. */
  currentDay: DayNumber;
  /** Quests on their current day. */
  questCount: number;
  todayQuestsDone: number;
  status: MemberTodayStatus;
  streak: number;
  totalXp: number;
  /** Finished challenge days in total. */
  daysCompleted: number;
  achievementsUnlocked: number;
  lastActivityAt: Timestamp | null;
};

export type TeamView = {
  id: string;
  /** "Ada's team". */
  name: string;
  capacity: number;
  /** The current user first, then in the order people joined — never a ranking. */
  members: MemberView[];
  isFull: boolean;
  finishedToday: number;
  /** Everyone finished today — and there is a team (two or more) to speak of. */
  isTeamDayComplete: boolean;
  /** Days in a row that everyone finished, up to today (or yesterday). */
  teamStreak: number;
  longestTeamStreak: number;
  /** The invite to share, while one is open. */
  invite: TeamInvite | null;
  /** When the server said all this. */
  asOf: Timestamp;
};

export function memberTodayStatus(
  member: Pick<MemberView, 'todayQuestsDone' | 'questCount'> & { todayCompleted: boolean },
): MemberTodayStatus {
  if (member.todayCompleted) return 'done';
  if (member.todayQuestsDone === 0) return 'notStarted';
  return member.todayQuestsDone >= member.questCount - 1 ? 'almostThere' : 'inProgress';
}

const questsOn = (plans: readonly CourseDay[], day: DayNumber) =>
  plans.find((plan) => plan.day === day)?.quests.length ?? 0;

function toView(
  summary: TeamMemberSummary,
  plans: readonly CourseDay[],
  { isCurrentUser, daysLater }: { isCurrentUser: boolean; daysLater: number },
): MemberView & { todayCompleted: boolean } {
  // A snapshot from an earlier day says nothing about today: nothing done yet.
  const stale = daysLater > 0;
  const currentDay = Math.min(summary.currentDay + daysLater, CHALLENGE.totalDays);
  const questCount = questsOn(plans, currentDay);
  const todayCompleted = stale ? false : summary.todayCompleted;
  const todayQuestsDone = stale ? 0 : summary.todayQuestsDone;
  return {
    userId: summary.userId,
    displayName: summary.displayName,
    avatarUrl: summary.avatarUrl,
    isCurrentUser,
    isOwner: summary.role === 'owner',
    joinedAt: summary.joinedAt,
    currentDay,
    questCount,
    todayQuestsDone,
    todayCompleted,
    status: memberTodayStatus({ todayCompleted, todayQuestsDone, questCount }),
    streak: summary.streak,
    totalXp: summary.totalXp,
    daysCompleted: summary.daysCompleted,
    achievementsUnlocked: summary.achievementsUnlocked,
    lastActivityAt: summary.lastActivityAt,
  };
}

export function buildTeamView(input: {
  team: TeamSnapshot;
  asOf: Timestamp;
  selfId: string;
  /** The user's own progress from this device; `null` keeps the server's. */
  me: MyProgress | null;
  plans: readonly CourseDay[];
  now: Date;
}): TeamView {
  const { team, asOf, selfId, me, plans, now } = input;
  const daysLater = Math.max(0, diffInCalendarDays(toLocalDate(new Date(asOf)), toLocalDate(now)));

  const members = team.members.map((summary) => {
    const isCurrentUser = summary.userId === selfId;
    const view = toView(summary, plans, { isCurrentUser, daysLater });
    if (!isCurrentUser || !me) return view;
    const questCount = questsOn(plans, me.currentDay);
    const todayCompleted = me.completedDays.has(me.currentDay);
    return {
      ...view,
      currentDay: me.currentDay,
      questCount,
      todayQuestsDone: me.todayQuestsDone,
      todayCompleted,
      status: memberTodayStatus({
        todayCompleted,
        todayQuestsDone: me.todayQuestsDone,
        questCount,
      }),
      streak: me.streak,
      totalXp: me.totalXp,
      daysCompleted: me.completedDays.size,
      achievementsUnlocked: me.achievementsUnlocked,
      lastActivityAt: me.lastActivityAt,
    };
  });
  const ordered = [
    ...members.filter((member) => member.isCurrentUser),
    ...members.filter((member) => !member.isCurrentUser),
  ];

  const finishedToday = ordered.filter((member) => member.todayCompleted).length;
  const isTeamDayComplete = ordered.length >= 2 && finishedToday === ordered.length;
  // The server's streak, as of its answer. When the user's own last quest
  // completes today's team day before the server has heard of it, the day is
  // already theirs to see.
  const sameDay = daysLater === 0;
  const predicted =
    sameDay && isTeamDayComplete && !team.streak.todayComplete
      ? team.streak.current + 1
      : team.streak.current;

  return {
    id: team.id,
    name: team.name,
    capacity: team.capacity,
    members: ordered.map(({ todayCompleted: _todayCompleted, ...member }) => member),
    isFull: ordered.length >= team.capacity,
    finishedToday,
    isTeamDayComplete,
    teamStreak: predicted,
    longestTeamStreak: Math.max(team.streak.longest, predicted),
    invite: team.invite && Date.parse(team.invite.expiresAt) > now.getTime() ? team.invite : null,
    asOf,
  };
}

/** Team streak facts for the badges' progress (the server alone unlocks the badge). */
export function teamStreakFacts(
  view: TeamView | null,
): { current: number; longest: number } | null {
  if (!view || view.members.length < 2) return null;
  return { current: view.teamStreak, longest: view.longestTeamStreak };
}
