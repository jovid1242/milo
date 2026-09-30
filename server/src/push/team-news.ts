import { Inject, Injectable, Logger } from '@nestjs/common';

import { challengeDayOn } from '@/features/challenge/logic/calendar';
import { countsFrom, finishedOn } from '@/features/friends/logic/team-streak';
import { localDateIn } from '@/lib/time-zone';
import { TEAM_STREAK_MILESTONES, type LocalDate, type PushKind, type PushPayload } from '@/schemas';

import { APP_CONFIG, type AppConfig } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import {
  loadRoster,
  nameOf,
  rosterStreak,
  streakMemberOf,
  type RosterMember,
} from '../teams/team-progress';
import {
  memberCompletedDayCopy,
  memberJoinedCopy,
  streakMilestoneCopy,
  teamDayCompleteCopy,
  yourTurnCopy,
  type PushCopy,
} from './push-copy';

type Tx = Prisma.TransactionClient;

/**
 * Which of a team day's news wins for one recipient. A day's news only ever
 * goes up for them — "Ada finished today", then "your turn", then "team day
 * complete" — and news still waiting gives way to more important news about
 * the same day: one action never leaves anyone with two notifications saying
 * nearly the same thing.
 */
export const PUSH_PRIORITY: Record<PushKind, number> = {
  TEAM_MEMBER_JOINED: 0,
  TEAM_MEMBER_COMPLETED_DAY: 1,
  TEAM_YOUR_TURN: 2,
  TEAM_DAY_COMPLETE: 3,
  TEAM_STREAK_MILESTONE: 4,
};

const HOUR_MS = 3_600_000;
/** Day news is worth sending until the recipient's day ends — 12 hours at most. */
const DAY_NEWS_MAX_MS = 12 * HOUR_MS;
/** A new teammate is news for a day. */
const JOIN_NEWS_MS = 24 * HOUR_MS;

/** A `date` column: midnight UTC of the calendar date. */
const toDateColumn = (date: LocalDate) => new Date(`${date}T00:00:00.000Z`);
const fromDateColumn = (date: Date) => date.toISOString().slice(0, 10);

/** The first minute when the calendar date in `timeZone` is no longer what it is at `now`. */
export function endOfDayIn(timeZone: string, now: Date): Date {
  const today = localDateIn(timeZone, now);
  let low = now.getTime();
  // No zone's day, DST included, lasts 26 hours.
  let high = low + 26 * HOUR_MS;
  while (high - low > 60_000) {
    const middle = Math.floor((low + high) / 2);
    if (localDateIn(timeZone, new Date(middle)) === today) low = middle;
    else high = middle;
  }
  return new Date(high);
}

type News = {
  userId: string;
  kind: PushKind;
  /** The event, for its recipient: the same news is never queued twice. */
  dedupeKey: string;
  copy: PushCopy;
  payload: PushPayload;
  /** The team day it is about; `null` for a new teammate. */
  eventDate: LocalDate | null;
  expiresAt: Date;
};

/**
 * Team news for the push outbox. Each method runs inside the transaction of
 * the change it reports, after that change is written: the news commits with
 * it, or not at all — and it is sent after the commit, by the push worker.
 * News goes only to members with a device that turned team notifications on,
 * and never to the member whose action it reports.
 */
@Injectable()
export class TeamNews {
  private readonly logger = new Logger('Push');

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * A member finished their challenge day for today (`date`, on their own
   * calendar), just now. The rest of the team hears one thing each: the team
   * day is complete (a streak milestone, when it is one), or it is their turn
   * as the last one to finish — or simply that this member finished.
   */
  async dayCompleted(
    tx: Tx,
    input: { userId: string; courseId: string; date: LocalDate; now: Date },
  ): Promise<void> {
    if (!this.config.push.enabled) return;
    const { userId, courseId, date, now } = input;
    const membership = await tx.teamMember.findUnique({
      where: { userId },
      select: { teamId: true },
    });
    if (!membership) return;
    const { teamId } = membership;
    // A team's day news is decided one finish at a time: two members finishing
    // at once take turns on the team's row (after their own, the order every
    // team change locks in), so exactly one of them completes the team day.
    await tx.$queryRaw`SELECT 1 FROM "teams" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
    const roster = await loadRoster(tx, teamId, courseId);
    const actor = roster.find((member) => member.userId === userId);
    if (!actor?.challenge) return;

    // Who the day asks for (the team streak's own rule) and who has finished it.
    const counted = roster.flatMap((member) => {
      const counts = streakMemberOf(member);
      return counts && countsFrom(counts) <= date
        ? [{ member, finished: finishedOn(counts, date) }]
        : [];
    });
    const done = counted.filter((entry) => entry.finished).map((entry) => entry.member);
    const waiting = counted.filter((entry) => !entry.finished).map((entry) => entry.member);
    const teamDay = counted.length >= 2 && waiting.length === 0;
    const streak = teamDay ? rosterStreak(roster, date).current : 0;
    const milestone = teamDay && (TEAM_STREAK_MILESTONES as readonly number[]).includes(streak);

    const news = roster.flatMap((recipient): News[] => {
      if (recipient.userId === userId || !recipient.challenge) return [];
      const { timeZone, startDate } = recipient.challenge;
      const base = {
        userId: recipient.userId,
        eventDate: date,
        expiresAt: new Date(
          Math.min(endOfDayIn(timeZone, now).getTime(), now.getTime() + DAY_NEWS_MAX_MS),
        ),
      };
      const payload = (kind: PushKind): PushPayload => ({
        kind,
        teamId,
        dayNumber: challengeDayOn(startDate, date),
      });
      if (teamDay) {
        const kind = milestone ? 'TEAM_STREAK_MILESTONE' : 'TEAM_DAY_COMPLETE';
        return [
          {
            ...base,
            kind,
            // One team day, one piece of news about it — whichever kind it is.
            dedupeKey: `team-day:${teamId}:${date}:${recipient.userId}`,
            copy: milestone ? streakMilestoneCopy(streak) : teamDayCompleteCopy(streak),
            payload: payload(kind),
          },
        ];
      }
      // The last one to finish — and still in that day on their own calendar.
      const last = waiting.length === 1 && waiting[0]?.userId === recipient.userId;
      if (last && localDateIn(timeZone, now) === date) {
        const other = done.length === 1 && done[0] ? nameOf(done[0]) : null;
        return [
          {
            ...base,
            kind: 'TEAM_YOUR_TURN',
            dedupeKey: `your-turn:${teamId}:${date}:${recipient.userId}`,
            copy: yourTurnCopy(done.length, counted.length, other),
            payload: payload('TEAM_YOUR_TURN'),
          },
        ];
      }
      return [
        {
          ...base,
          kind: 'TEAM_MEMBER_COMPLETED_DAY',
          dedupeKey: `member-day:${teamId}:${date}:${userId}:${recipient.userId}`,
          copy: memberCompletedDayCopy(nameOf(actor), done.length, counted.length),
          payload: payload('TEAM_MEMBER_COMPLETED_DAY'),
        },
      ];
    });

    // The member who just finished needs no "your turn" for the day any more.
    await tx.pushJob.updateMany({
      where: {
        userId,
        teamId,
        kind: 'TEAM_YOUR_TURN',
        eventDate: toDateColumn(date),
        status: 'pending',
      },
      data: { status: 'cancelled', reason: 'done' },
    });
    await this.enqueue(tx, teamId, news, now);
  }

  /** Someone joined the team — called in the join's transaction, with the team's row locked. */
  async memberJoined(
    tx: Tx,
    input: { teamId: string; courseId: string; userId: string; now: Date },
  ): Promise<void> {
    if (!this.config.push.enabled) return;
    const { teamId, courseId, userId, now } = input;
    const roster = await loadRoster(tx, teamId, courseId);
    const joiner = roster.find((member) => member.userId === userId);
    if (!joiner) return;
    // Leaving and joining again the same day is not news twice.
    const day = now.toISOString().slice(0, 10);
    const news = roster
      .filter((member: RosterMember) => member.userId !== userId)
      .map((recipient): News => ({
        userId: recipient.userId,
        kind: 'TEAM_MEMBER_JOINED',
        dedupeKey: `joined:${teamId}:${userId}:${day}:${recipient.userId}`,
        copy: memberJoinedCopy(nameOf(joiner)),
        payload: { kind: 'TEAM_MEMBER_JOINED', teamId },
        eventDate: null,
        expiresAt: new Date(now.getTime() + JOIN_NEWS_MS),
      }));
    await this.enqueue(tx, teamId, news, now);
  }

  private async enqueue(tx: Tx, teamId: string, news: News[], now: Date): Promise<void> {
    if (news.length === 0) return;
    // Only for people with a device that asked for team notifications, signed
    // in (sessions live on the system clock, as everywhere in auth).
    const reachable = new Set(
      (
        await tx.pushDevice.findMany({
          where: {
            userId: { in: news.map((item) => item.userId) },
            session: { revokedAt: null, expiresAt: { gt: new Date() } },
          },
          select: { userId: true },
        })
      ).map((device) => device.userId),
    );
    let queued = news.filter((item) => reachable.has(item.userId));

    const dated = queued.filter((item) => item.eventDate !== null);
    if (dated.length > 0) {
      const earlier = await tx.pushJob.findMany({
        where: {
          teamId,
          userId: { in: dated.map((item) => item.userId) },
          eventDate: {
            in: [...new Set(dated.flatMap((item) => item.eventDate ?? []))].map(toDateColumn),
          },
          status: { in: ['pending', 'sending', 'sent'] },
        },
        select: { userId: true, eventDate: true, priority: true },
      });
      // A day's news only goes up for its recipient...
      queued = queued.filter(
        (item) =>
          item.eventDate === null ||
          !earlier.some(
            (job) =>
              job.userId === item.userId &&
              job.eventDate !== null &&
              fromDateColumn(job.eventDate) === item.eventDate &&
              job.priority > PUSH_PRIORITY[item.kind],
          ),
      );
      // ...and lesser news about the day, still waiting, gives way.
      for (const item of queued) {
        if (item.eventDate === null) continue;
        await tx.pushJob.updateMany({
          where: {
            teamId,
            userId: item.userId,
            eventDate: toDateColumn(item.eventDate),
            status: 'pending',
            priority: { lt: PUSH_PRIORITY[item.kind] },
          },
          data: { status: 'cancelled', reason: 'superseded' },
        });
      }
    }
    if (queued.length === 0) return;

    const created = await tx.pushJob.createMany({
      data: queued.map((item) => ({
        dedupeKey: item.dedupeKey,
        userId: item.userId,
        kind: item.kind,
        priority: PUSH_PRIORITY[item.kind],
        teamId,
        eventDate: item.eventDate === null ? null : toDateColumn(item.eventDate),
        title: item.copy.title,
        body: item.copy.body,
        data: item.payload,
        runAt: now,
        expiresAt: item.expiresAt,
        createdAt: now,
      })),
      // The same event again (a retried or repeated change): already queued.
      skipDuplicates: true,
    });
    this.logger.log(
      {
        teamId,
        kinds: [...new Set(queued.map((item) => item.kind))],
        queued: created.count,
        duplicates: queued.length - created.count,
      },
      'Push queued',
    );
  }
}
