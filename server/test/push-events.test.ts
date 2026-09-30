import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  MyTeamResponseSchema,
  PushPayloadSchema,
  TeamInviteResponseSchema,
  type AuthSession,
  type TeamSnapshot,
} from '@/schemas';

import { bearer, register, resetDatabase, startApp, TestClock, type TestApp } from './helpers';
import { completeQuest, playDay, questsOf, startChallenge, sync } from './progress-fixtures';
import { FakeExpo, pushToken, registerDevice } from './push-fixtures';

/**
 * Team news, queued in the transaction of the change it is about: who hears
 * what, exactly once, and one piece of news per person per action.
 */

const DAY_ONE = '2026-09-01';
const clock = new TestClock(new Date(`${DAY_ONE}T10:00:00.000Z`));
let t: TestApp;

beforeAll(async () => {
  t = await startApp({ clock, listen: true, pushTransport: new FakeExpo() });
});
afterAll(() => t.close());

beforeEach(async () => {
  await resetDatabase(t.prisma);
  clock.set(`${DAY_ONE}T10:00:00.000Z`);
});

type Person = { session: AuthSession; id: string; name: string; revision: number };
const people = new Map<string, string>();

/** An account after onboarding (a name, a challenge started on Day One) — with notifications on unless not. */
async function person(name: string, { device = true } = {}): Promise<Person> {
  const session = await register(t.http, `${name.toLowerCase()}@example.com`);
  await request(t.http)
    .patch('/api/v1/users/me')
    .set('Authorization', bearer(session))
    .send({ displayName: name })
    .expect(200);
  const started = await sync(t.http, session, [startChallenge(DAY_ONE)]);
  if (device) await registerDevice(t.http, session, pushToken());
  people.set(session.user.id, name);
  return { session, id: session.user.id, name, revision: started.revision };
}

async function teamWith(owner: Person, ...others: Person[]): Promise<TeamSnapshot> {
  const created = await request(t.http)
    .post('/api/v1/teams')
    .set('Authorization', bearer(owner.session))
    .expect(201);
  const team = MyTeamResponseSchema.parse(created.body).team;
  if (!team) throw new Error('No team');
  const invite = TeamInviteResponseSchema.parse(
    (
      await request(t.http)
        .post(`/api/v1/teams/${team.id}/invites`)
        .set('Authorization', bearer(owner.session))
        .expect(200)
    ).body,
  ).invite;
  for (const other of others) await joinWith(other, invite.code);
  return team;
}

const joinWith = (who: Person, code: string) =>
  request(t.http)
    .post('/api/v1/team-invites/join')
    .set('Authorization', bearer(who.session))
    .send({ code })
    .expect(200);

/** Plays a whole day, as the phone syncs it. */
async function play(who: Person, day: number, mutations = playDay(day)) {
  const response = await sync(t.http, who.session, mutations, who.revision);
  who.revision = response.revision;
  return response;
}

/** The outbox as people would read it: by recipient, then by importance. */
async function news(status?: 'pending' | 'cancelled') {
  const jobs = await t.prisma.pushJob.findMany({ where: status ? { status } : {} });
  return jobs
    .map((job) => ({
      to: people.get(job.userId) ?? '?',
      kind: job.kind,
      status: job.status,
      reason: job.reason,
      title: job.title,
      body: job.body,
      data: job.data,
      priority: job.priority,
    }))
    .sort((a, b) => a.to.localeCompare(b.to) || a.priority - b.priority)
    .map(({ priority: _priority, ...job }) => job);
}

const pending = async () =>
  (await news('pending')).map(({ to, kind, title, body }) => ({ to, kind, title, body }));

/**
 * Days with no course content yet are put in place as a finished day leaves
 * them (the course has days 1, 2, 7, 89 and 90).
 */
async function recordDays(who: Person, days: number[]) {
  const challenge = await t.prisma.userChallenge.findFirstOrThrow({ where: { userId: who.id } });
  await t.prisma.dayCompletion.createMany({
    data: days.map((day) => ({
      challengeId: challenge.id,
      day,
      questCount: 4,
      xpEarned: 60,
      streakBefore: 0,
      streakAfter: 1,
      isPerfect: false,
      completedAt: new Date(Date.parse(`${DAY_ONE}T12:00:00.000Z`) + (day - 1) * 86_400_000),
    })),
  });
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('a new teammate', () => {
  it('is news for everyone already in the team — not for the one who joined', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    const team = await teamWith(ada, bea);
    expect(await pending()).toEqual([
      {
        to: 'Ada',
        kind: 'TEAM_MEMBER_JOINED',
        title: 'Bea joined your team',
        body: 'Climb the 90 days together — the team streak grows on the days everyone finishes.',
      },
    ]);

    const invite = TeamInviteResponseSchema.parse(
      (
        await request(t.http)
          .post(`/api/v1/teams/${team.id}/invites`)
          .set('Authorization', bearer(bea.session))
          .expect(200)
      ).body,
    ).invite;
    await joinWith(cy, invite.code);
    expect((await pending()).slice(1)).toEqual([
      expect.objectContaining({ to: 'Ada', title: 'Cy joined your team' }),
      expect.objectContaining({ to: 'Bea', title: 'Cy joined your team' }),
    ]);
    const [job] = await news();
    expect(job?.data).toEqual({ kind: 'TEAM_MEMBER_JOINED', teamId: team.id });

    // Leaving and joining again the same day is not news twice.
    await request(t.http)
      .post(`/api/v1/teams/${team.id}/leave`)
      .set('Authorization', bearer(cy.session))
      .expect(204);
    await joinWith(cy, invite.code);
    expect(await pending()).toHaveLength(3);
  });
});

describe('a member finishing today', () => {
  it('is news for the others — once, however often the phone syncs it', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    const team = await teamWith(ada, bea, cy);
    await t.prisma.pushJob.deleteMany();

    const day = playDay(1);
    await play(ada, 1, day);
    expect(await pending()).toEqual([
      {
        to: 'Bea',
        kind: 'TEAM_MEMBER_COMPLETED_DAY',
        title: 'Ada finished today',
        body: '1 of 3 finished today. Everyone’s moving.',
      },
      {
        to: 'Cy',
        kind: 'TEAM_MEMBER_COMPLETED_DAY',
        title: 'Ada finished today',
        body: '1 of 3 finished today. Everyone’s moving.',
      },
    ]);
    const [job] = await news();
    expect(PushPayloadSchema.strict().parse(job?.data)).toEqual({
      kind: 'TEAM_MEMBER_COMPLETED_DAY',
      teamId: team.id,
      dayNumber: 1,
    });

    // The same mutations again (a retry), the day played again with new ids,
    // and a sync with nothing in it: no news.
    await sync(t.http, ada.session, day, 0);
    await play(ada, 1);
    await play(ada, 1, []);
    expect(await news()).toHaveLength(2);
  });

  it('gives the last one to finish their turn — and nothing lesser still waiting', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    await teamWith(ada, bea, cy);
    await t.prisma.pushJob.deleteMany();

    await play(ada, 1);
    await play(bea, 1);
    expect(await pending()).toEqual([
      {
        to: 'Ada',
        kind: 'TEAM_MEMBER_COMPLETED_DAY',
        title: 'Bea finished today',
        body: '2 of 3 finished today. One more to go.',
      },
      {
        to: 'Bea',
        kind: 'TEAM_MEMBER_COMPLETED_DAY',
        title: 'Ada finished today',
        body: '1 of 3 finished today. Everyone’s moving.',
      },
      {
        to: 'Cy',
        kind: 'TEAM_YOUR_TURN',
        title: 'One more to go',
        body: '2 of 3 are done — your turn!',
      },
    ]);
    // Cy's "Ada finished today", still waiting, gave way to "your turn".
    expect(await news('cancelled')).toEqual([
      expect.objectContaining({
        to: 'Cy',
        kind: 'TEAM_MEMBER_COMPLETED_DAY',
        reason: 'superseded',
      }),
    ]);
  });

  it('completes the team day once: the others hear it, and nothing lesser waits', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    const team = await teamWith(ada, bea, cy);
    await t.prisma.pushJob.deleteMany();

    await play(ada, 1);
    await play(bea, 1);
    const cys = playDay(1);
    await play(cy, 1, cys);
    expect((await pending()).filter((item) => item.kind === 'TEAM_DAY_COMPLETE')).toEqual([
      {
        to: 'Ada',
        kind: 'TEAM_DAY_COMPLETE',
        title: 'Team day complete',
        body: 'Everyone finished today. Team streak: 1 day.',
      },
      {
        to: 'Bea',
        kind: 'TEAM_DAY_COMPLETE',
        title: 'Team day complete',
        body: 'Everyone finished today. Team streak: 1 day.',
      },
    ]);
    // Everything lesser about the day that was still waiting gave way: Ada's
    // and Bea's "… finished today", Cy's "Ada finished today" — and Cy got
    // through, so "your turn" is moot.
    expect((await pending()).map((item) => [item.to, item.kind])).toEqual([
      ['Ada', 'TEAM_DAY_COMPLETE'],
      ['Bea', 'TEAM_DAY_COMPLETE'],
    ]);
    expect((await news('cancelled')).map((item) => [item.to, item.kind, item.reason])).toEqual([
      ['Ada', 'TEAM_MEMBER_COMPLETED_DAY', 'superseded'],
      ['Bea', 'TEAM_MEMBER_COMPLETED_DAY', 'superseded'],
      ['Cy', 'TEAM_MEMBER_COMPLETED_DAY', 'superseded'],
      ['Cy', 'TEAM_YOUR_TURN', 'done'],
    ]);
    const complete = await t.prisma.pushJob.findFirstOrThrow({
      where: { kind: 'TEAM_DAY_COMPLETE' },
    });
    expect(complete.data).toEqual({ kind: 'TEAM_DAY_COMPLETE', teamId: team.id, dayNumber: 1 });

    const before = await news();
    await sync(t.http, cy.session, cys, 0);
    expect(await news()).toEqual(before);
  });

  it('in a team of two, names the other one on "your turn"', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    await teamWith(ada, bea);
    await t.prisma.pushJob.deleteMany();

    await play(bea, 1);
    expect(await pending()).toEqual([
      {
        to: 'Ada',
        kind: 'TEAM_YOUR_TURN',
        title: 'One more to go',
        body: 'Bea is done — your turn!',
      },
    ]);
    await play(ada, 1);
    expect(await pending()).toEqual([
      expect.objectContaining({ to: 'Bea', kind: 'TEAM_DAY_COMPLETE' }),
    ]);
  });

  it('is quiet about a day finished late, after time offline', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    await teamWith(ada, bea);
    await t.prisma.pushJob.deleteMany();

    clock.advanceDays(1);
    await play(ada, 1, playDay(1, `${DAY_ONE}T19:00:00.000Z`));
    expect(await news()).toEqual([]);
  });

  it('reaches only people who turned team notifications on — and are still signed in', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea', { device: false })];
    const cy = await person('Cy');
    await teamWith(ada, bea, cy);
    await t.prisma.pushJob.deleteMany();

    // Cy turns them off again; Bea never turned them on.
    await request(t.http)
      .delete('/api/v1/push/devices/current')
      .set('Authorization', bearer(cy.session))
      .expect(204);
    await play(ada, 1);
    expect(await news()).toEqual([]);

    // Cy turns them on, then signs out: Ada (still on) is the only one to hear of Bea.
    await registerDevice(t.http, cy.session, pushToken());
    await request(t.http)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: cy.session.refreshToken })
      .expect(204);
    await play(bea, 1);
    expect((await news()).map((item) => [item.to, item.kind])).toEqual([
      ['Ada', 'TEAM_MEMBER_COMPLETED_DAY'],
    ]);
  });
});

describe('team streak milestones', () => {
  it.each([
    { streak: 7, day: 7 },
    { streak: 14, day: 89 },
    { streak: 30, day: 89 },
    { streak: 50, day: 89 },
    { streak: 90, day: 90 },
  ])('a $streak-day team streak is celebrated instead of the day', async ({ streak, day }) => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    const team = await teamWith(ada, bea);
    for (const who of [ada, bea]) await recordDays(who, range(day - streak + 1, day - 1));
    clock.advanceDays(day - 1);
    await t.prisma.pushJob.deleteMany();

    await play(ada, day);
    await play(bea, day);
    const [celebration] = await news('pending').then((items) =>
      items.filter((item) => item.kind !== 'TEAM_YOUR_TURN'),
    );
    expect(celebration).toEqual({
      to: 'Ada',
      kind: 'TEAM_STREAK_MILESTONE',
      status: 'pending',
      reason: null,
      title: `${streak}-day team streak!`,
      body: `Everyone finished ${streak} days in a row. Keep climbing together.`,
      data: { kind: 'TEAM_STREAK_MILESTONE', teamId: team.id, dayNumber: day },
    });
    expect(await t.prisma.pushJob.count({ where: { kind: 'TEAM_DAY_COMPLETE' } })).toBe(0);
  });

  it.each([
    { streak: 8, day: 89 },
    { streak: 13, day: 89 },
    { streak: 2, day: 2 },
  ])('a $streak-day team streak is a team day like any other', async ({ streak, day }) => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    await teamWith(ada, bea);
    for (const who of [ada, bea]) {
      if (day === 2) await play(who, 1);
      else await recordDays(who, range(day - streak + 1, day - 1));
    }
    clock.advanceDays(day - 1);
    await t.prisma.pushJob.deleteMany();

    await play(ada, day);
    await play(bea, day);
    expect(await pending()).toEqual([
      {
        to: 'Ada',
        kind: 'TEAM_DAY_COMPLETE',
        title: 'Team day complete',
        body: `Everyone finished today. Team streak: ${streak} days.`,
      },
    ]);
  });
});

describe('finishing at the same moment', () => {
  /** Everything of today but the last quest, so the last one can be raced. */
  async function allButLast(who: Person, day: number) {
    const quests = playDay(day);
    await play(who, day, quests.slice(0, -1));
    return quests.at(-1) ?? completeQuest(questsOf(day).at(-1) ?? '');
  }

  it('two members completing the team day at once: it is complete exactly once', async () => {
    for (let round = 0; round < 3; round += 1) {
      await resetDatabase(t.prisma);
      const [ada, bea] = [await person('Ada'), await person('Bea')];
      await teamWith(ada, bea);
      const [adaLast, beaLast] = [await allButLast(ada, 1), await allButLast(bea, 1)];
      await t.prisma.pushJob.deleteMany();

      await Promise.all([play(ada, 1, [adaLast]), play(bea, 1, [beaLast])]);
      const kinds = (await pending()).map((item) => item.kind);
      expect(kinds).toEqual(['TEAM_DAY_COMPLETE']);
    }
  });

  it('the last two of three at once: everyone but the last one to finish hears it, once', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    await teamWith(ada, bea, cy);
    await play(ada, 1);
    const [beaLast, cyLast] = [await allButLast(bea, 1), await allButLast(cy, 1)];
    await t.prisma.pushJob.deleteMany();

    await Promise.all([play(bea, 1, [beaLast]), play(cy, 1, [cyLast])]);
    const complete = (await pending()).filter((item) => item.kind === 'TEAM_DAY_COMPLETE');
    expect(complete.map((item) => item.to).sort()).toHaveLength(2);
    expect(complete.map((item) => item.to)).toContain('Ada');
    // Nobody is left with "your turn" or a lesser word about the day.
    expect((await pending()).filter((item) => item.kind !== 'TEAM_DAY_COMPLETE')).toEqual([]);
  });
});

describe('with push notifications turned off', () => {
  it('nothing is queued', async () => {
    const quiet = await startApp({ clock, env: { PUSH_ENABLED: 'false' } });
    try {
      const signUp = async (name: string) => {
        const session = await register(quiet.http, `${name}@example.com`);
        await sync(quiet.http, session, [startChallenge(DAY_ONE)]);
        await registerDevice(quiet.http, session, pushToken());
        return session;
      };
      const [ada, bea] = [await signUp('ada'), await signUp('bea')];
      const team = MyTeamResponseSchema.parse(
        (
          await request(quiet.http)
            .post('/api/v1/teams')
            .set('Authorization', bearer(ada))
            .expect(201)
        ).body,
      ).team;
      const invite = TeamInviteResponseSchema.parse(
        (
          await request(quiet.http)
            .post(`/api/v1/teams/${team?.id ?? ''}/invites`)
            .set('Authorization', bearer(ada))
            .expect(200)
        ).body,
      ).invite;
      await request(quiet.http)
        .post('/api/v1/team-invites/join')
        .set('Authorization', bearer(bea))
        .send({ code: invite.code })
        .expect(200);
      await sync(quiet.http, bea, playDay(1), 1);
      expect(await quiet.prisma.pushJob.count()).toBe(0);
    } finally {
      await quiet.close();
    }
  });
});
