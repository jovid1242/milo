import { challengeDayOn } from '@/features/challenge/logic/calendar';
import { teamStreakOf, type TeamStreakMember } from '@/features/friends/logic/team-streak';
import { computeStreak } from '@/features/progress/logic/streak';
import { localDateIn } from '@/lib/time-zone';
import {
  TEAM_CAPACITY,
  type DayNumber,
  type LocalDate,
  type TeamInvite,
  type TeamMemberSummary,
  type TeamSnapshot,
  type TeamStreak,
} from '@/schemas';

import type { Prisma } from '../generated/prisma/client';

/**
 * What a team shows of its members, derived from the server's own progress
 * records — the same ones the members' devices sync — and never from anything
 * a device claims. Only summaries leave here: no email, no answers, no history.
 */

type Db = Prisma.TransactionClient;

/** A `date` column: midnight UTC of the calendar date. */
const toLocalDate = (date: Date) => date.toISOString().slice(0, 10);
const iso = (date: Date) => date.toISOString();

/** A member, with what their summary and the team streak are made of. */
export type RosterMember = {
  userId: string;
  displayName: string | null;
  role: 'owner' | 'member';
  joinedAt: Date;
  /** Their challenge in the team's course (a member always has one: joining needs it). */
  challenge: {
    id: string;
    startDate: LocalDate;
    timeZone: string;
    /** Challenge days the server recorded as finished. */
    completedDays: Set<DayNumber>;
  } | null;
};

/** The team's members, in the order they joined, with their challenges. */
export async function loadRoster(
  db: Db,
  teamId: string,
  courseId: string,
): Promise<RosterMember[]> {
  const members = await db.teamMember.findMany({
    where: { teamId },
    orderBy: [{ joinedAt: 'asc' }, { slot: 'asc' }],
    select: { userId: true, role: true, joinedAt: true, user: { select: { displayName: true } } },
  });
  const challenges = await db.userChallenge.findMany({
    where: { userId: { in: members.map((member) => member.userId) }, courseId },
    select: {
      id: true,
      userId: true,
      startDate: true,
      timeZone: true,
      dayCompletions: { select: { day: true } },
    },
  });
  return members.map((member) => {
    const challenge = challenges.find((item) => item.userId === member.userId);
    return {
      userId: member.userId,
      displayName: member.user.displayName,
      role: member.role,
      joinedAt: member.joinedAt,
      challenge: challenge
        ? {
            id: challenge.id,
            startDate: toLocalDate(challenge.startDate),
            timeZone: challenge.timeZone,
            completedDays: new Set(challenge.dayCompletions.map((record) => record.day)),
          }
        : null,
    };
  });
}

/**
 * The team streak on `today` (the viewer's date). `own` stands in for one
 * member's finished days — a mutation's, decided but not written yet.
 */
export function rosterStreak(
  roster: readonly RosterMember[],
  today: LocalDate,
  own?: { userId: string; completedDays: ReadonlySet<DayNumber> },
): TeamStreak {
  const members: TeamStreakMember[] = roster.flatMap((member) =>
    member.challenge
      ? [
          {
            startDate: member.challenge.startDate,
            joinedOn: localDateIn(member.challenge.timeZone, member.joinedAt),
            completedDays:
              own?.userId === member.userId ? own.completedDays : member.challenge.completedDays,
          },
        ]
      : [],
  );
  return teamStreakOf(members, today);
}

/** How a member is called in the team (a name is set in onboarding; until then, this). */
export const nameOf = (member: Pick<RosterMember, 'displayName'>) =>
  member.displayName ?? 'Teammate';

/** "Ada's team" — until teams can be named. */
export function teamName(name: string | null, roster: readonly RosterMember[]): string {
  if (name) return name;
  const owner = roster.find((member) => member.role === 'owner') ?? roster[0];
  return owner?.displayName ? `${owner.displayName}'s team` : 'Milo team';
}

/** Each member as the team sees them, now. */
export async function memberSummaries(
  db: Db,
  roster: readonly RosterMember[],
  now: Date,
): Promise<TeamMemberSummary[]> {
  const ids = roster.flatMap((member) => (member.challenge ? [member.challenge.id] : []));
  // One after another: a transaction is one connection.
  const xp = await db.xpLedgerEntry.groupBy({
    by: ['challengeId'],
    where: { challengeId: { in: ids } },
    _sum: { amount: true },
  });
  const badges = await db.achievementUnlock.groupBy({
    by: ['challengeId'],
    where: { challengeId: { in: ids } },
    _count: { _all: true },
  });
  const quests = await db.questCompletion.groupBy({
    by: ['challengeId', 'day'],
    where: { challengeId: { in: ids } },
    _count: { _all: true },
    _max: { completedAt: true },
  });
  return roster.map((member): TeamMemberSummary => {
    const base = {
      userId: member.userId,
      displayName: nameOf(member),
      avatarUrl: null,
      role: member.role,
      joinedAt: iso(member.joinedAt),
    };
    const challenge = member.challenge;
    if (!challenge) {
      return {
        ...base,
        currentDay: 1,
        todayCompleted: false,
        todayQuestsDone: 0,
        streak: 0,
        totalXp: 0,
        daysCompleted: 0,
        achievementsUnlocked: 0,
        lastActivityAt: null,
      };
    }
    const currentDay = challengeDayOn(challenge.startDate, localDateIn(challenge.timeZone, now));
    const days = quests.filter((row) => row.challengeId === challenge.id);
    const last = days
      .map((row) => row._max.completedAt)
      .filter((time): time is Date => time !== null)
      .reduce<Date | null>((latest, time) => (latest && latest > time ? latest : time), null);
    return {
      ...base,
      currentDay,
      todayCompleted: challenge.completedDays.has(currentDay),
      todayQuestsDone: days.find((row) => row.day === currentDay)?._count._all ?? 0,
      streak: computeStreak(challenge.completedDays, currentDay),
      totalXp: xp.find((row) => row.challengeId === challenge.id)?._sum.amount ?? 0,
      daysCompleted: challenge.completedDays.size,
      achievementsUnlocked:
        badges.find((row) => row.challengeId === challenge.id)?._count._all ?? 0,
      lastActivityAt: last ? iso(last) : null,
    };
  });
}

/** The viewer's calendar date: their challenge's time zone, or UTC without one. */
export function todayOf(roster: readonly RosterMember[], viewerId: string, now: Date): LocalDate {
  const viewer = roster.find((member) => member.userId === viewerId);
  return localDateIn(viewer?.challenge?.timeZone ?? 'UTC', now);
}

/** The whole team as `viewerId` (a member) sees it. */
export async function teamSnapshot(
  db: Db,
  input: {
    team: { id: string; courseId: string; name: string | null; createdAt: Date };
    viewerId: string;
    now: Date;
    invite: TeamInvite | null;
  },
): Promise<TeamSnapshot> {
  const { team, viewerId, now } = input;
  const roster = await loadRoster(db, team.id, team.courseId);
  return {
    id: team.id,
    name: teamName(team.name, roster),
    capacity: TEAM_CAPACITY,
    createdAt: iso(team.createdAt),
    members: await memberSummaries(db, roster, now),
    streak: rosterStreak(roster, todayOf(roster, viewerId, now)),
    invite: input.invite,
  };
}
