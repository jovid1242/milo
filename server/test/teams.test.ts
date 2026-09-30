import { Writable } from 'node:stream';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  InvitePreviewResponseSchema,
  MyTeamResponseSchema,
  TeamInviteResponseSchema,
  TeamMemberSummarySchema,
  type AuthSession,
  type TeamInvite,
  type TeamSnapshot,
} from '@/schemas';

import { bearer, register, resetDatabase, startApp, TestClock, type TestApp } from './helpers';
import { playDay, startChallenge, sync } from './progress-fixtures';

/**
 * Teams on the server: made, joined and left only here, with the database
 * holding the line on capacity; members see each other as summaries derived
 * from the server's own progress records.
 */

const DAY_ONE = '2026-09-01';
const clock = new TestClock(new Date(`${DAY_ONE}T10:00:00.000Z`));
const lines: string[] = [];
let t: TestApp;

beforeAll(async () => {
  t = await startApp({
    clock,
    // Listening already: many requests at once share it instead of each binding a port.
    listen: true,
    env: { LOG_LEVEL: 'info' },
    logDestination: new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    }),
  });
});
afterAll(() => t.close());

beforeEach(async () => {
  await resetDatabase(t.prisma);
  clock.set(`${DAY_ONE}T10:00:00.000Z`);
  lines.length = 0;
});

type Person = { session: AuthSession; id: string; name: string };

/** An account as onboarding leaves it: a name, and a challenge started today (or not). */
async function person(
  name: string,
  { start = true, startDate = DAY_ONE }: { start?: boolean; startDate?: string } = {},
): Promise<Person> {
  const session = await register(t.http, `${name.toLowerCase()}@example.com`);
  await request(t.http)
    .patch('/api/v1/users/me')
    .set('Authorization', bearer(session))
    .send({ displayName: name })
    .expect(200);
  if (start) await sync(t.http, session, [startChallenge(startDate)]);
  return { session, id: session.user.id, name };
}

const as = (who: Person) => {
  const auth = bearer(who.session);
  return {
    me: () => request(t.http).get('/api/v1/teams/me').set('Authorization', auth),
    create: () => request(t.http).post('/api/v1/teams').set('Authorization', auth),
    invite: (teamId: string) =>
      request(t.http).post(`/api/v1/teams/${teamId}/invites`).set('Authorization', auth),
    revoke: (inviteId: string) =>
      request(t.http).delete(`/api/v1/team-invites/${inviteId}`).set('Authorization', auth),
    preview: (code: string) =>
      request(t.http)
        .post('/api/v1/team-invites/preview')
        .set('Authorization', auth)
        .send({ code }),
    join: (code: string) =>
      request(t.http).post('/api/v1/team-invites/join').set('Authorization', auth).send({ code }),
    leave: (teamId: string) =>
      request(t.http).post(`/api/v1/teams/${teamId}/leave`).set('Authorization', auth),
  };
};

async function teamOf(who: Person): Promise<TeamSnapshot | null> {
  return MyTeamResponseSchema.parse((await as(who).me().expect(200)).body).team;
}

async function createTeam(who: Person): Promise<TeamSnapshot> {
  const team = MyTeamResponseSchema.parse((await as(who).create().expect(201)).body).team;
  if (!team) throw new Error('No team');
  return team;
}

async function inviteOf(who: Person, teamId: string): Promise<TeamInvite> {
  return TeamInviteResponseSchema.parse((await as(who).invite(teamId).expect(200)).body).invite;
}

async function join(who: Person, code: string): Promise<TeamSnapshot> {
  const team = MyTeamResponseSchema.parse((await as(who).join(code).expect(200)).body).team;
  if (!team) throw new Error('No team');
  return team;
}

/** Ada's team, with the others in it in this order. */
async function teamWith(owner: Person, ...others: Person[]) {
  const team = await createTeam(owner);
  const invite = await inviteOf(owner, team.id);
  for (const other of others) await join(other, invite.code);
  return { team, invite };
}

const names = (team: TeamSnapshot | null) => team?.members.map((member) => member.displayName);
const logsOf = (message: string) =>
  lines
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((line) => line['msg'] === message);
const errorCode = (response: request.Response) => (response.body as { code?: string }).code;

describe('making a team', () => {
  it('makes the creator its owner and only member', async () => {
    const ada = await person('Ada');
    expect(await teamOf(ada)).toBeNull();

    const team = await createTeam(ada);
    expect(team).toMatchObject({
      name: "Ada's team",
      capacity: 3,
      streak: { current: 0, longest: 0, todayComplete: false },
      invite: null,
    });
    expect(team.members).toEqual([
      expect.objectContaining({ userId: ada.id, displayName: 'Ada', role: 'owner', currentDay: 1 }),
    ]);
    expect(await teamOf(ada)).toEqual(team);
    expect(logsOf('Team created')).toEqual([
      expect.objectContaining({ teamId: team.id, userId: ada.id }),
    ]);
  });

  it('allows one team per person', async () => {
    const ada = await person('Ada');
    await createTeam(ada);
    const again = await as(ada).create().expect(409);
    expect(errorCode(again)).toBe('ALREADY_IN_TEAM');
    expect(await t.prisma.team.count()).toBe(1);
  });

  it('is for a challenge that has started', async () => {
    const ada = await person('Ada', { start: false });
    expect(errorCode(await as(ada).create().expect(409))).toBe('CHALLENGE_NOT_STARTED');
  });

  it('needs to be signed in, everywhere', async () => {
    await request(t.http).get('/api/v1/teams/me').expect(401);
    await request(t.http).post('/api/v1/teams').expect(401);
    await request(t.http).post('/api/v1/team-invites/preview').send({ code: 'x' }).expect(401);
    await request(t.http).post('/api/v1/team-invites/join').send({ code: 'x' }).expect(401);
  });
});

describe('invites', () => {
  it('gives every member the same open invite, with a code to type or tap', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    const team = await createTeam(ada);
    const invite = await inviteOf(ada, team.id);
    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(invite).toMatchObject({
      createdBy: ada.id,
      expiresAt: new Date(`2026-09-08T10:00:00.000Z`).toISOString(),
    });
    await join(bea, invite.code);

    expect(await inviteOf(bea, team.id)).toEqual(invite);
    expect((await teamOf(bea))?.invite).toEqual(invite);
    // A day before it ends, the next member to ask gets a fresh one.
    clock.advanceDays(6.5);
    const fresh = await inviteOf(bea, team.id);
    expect(fresh.code).not.toBe(invite.code);
    expect(fresh.createdBy).toBe(bea.id);
  });

  it('never stores or logs the code itself', async () => {
    const ada = await person('Ada');
    const team = await createTeam(ada);
    const invite = await inviteOf(ada, team.id);
    const rows = await t.prisma.$queryRaw<unknown[]>`SELECT * FROM "team_invites"`;
    const compact = invite.code.replace('-', '');
    for (const text of [JSON.stringify(rows), lines.join('\n')]) {
      expect(text).not.toContain(invite.code);
      expect(text).not.toContain(compact);
    }
    expect(logsOf('Invite created')).toEqual([
      expect.objectContaining({ teamId: team.id, inviteId: invite.id, userId: ada.id }),
    ]);
  });

  it('shows the team before joining — its name, owner and size, nobody’s progress', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    const team = await createTeam(ada);
    await sync(t.http, ada.session, playDay(1), 1);
    const invite = await inviteOf(ada, team.id);

    const response = await as(bea).preview(invite.code).expect(200);
    expect(response.body).toEqual({
      preview: {
        teamName: "Ada's team",
        ownerName: 'Ada',
        memberCount: 1,
        capacity: 3,
        expiresAt: invite.expiresAt,
        status: 'canJoin',
      },
    });
    InvitePreviewResponseSchema.parse(response.body);
    // Typed any way at all.
    for (const typed of [invite.code.toLowerCase(), ` ${invite.code.replace('-', ' ')} `]) {
      await as(bea).preview(typed).expect(200);
    }
    expect(await teamOf(bea)).toBeNull();
  });

  it('refuses codes that are wrong, expired or turned off — each for what it is', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    const team = await createTeam(ada);
    const invite = await inviteOf(ada, team.id);

    for (const code of ['AAAAA-AAAAA', 'hello', 'O0O0O-I1I1I', 'x'.repeat(64)]) {
      expect(errorCode(await as(bea).preview(code).expect(404))).toBe('INVITE_INVALID');
      expect(errorCode(await as(bea).join(code).expect(404))).toBe('INVITE_INVALID');
    }
    await as(bea).preview('x'.repeat(65)).expect(400);

    await as(ada).revoke(invite.id).expect(204);
    expect(errorCode(await as(bea).preview(invite.code).expect(410))).toBe('INVITE_REVOKED');
    expect(errorCode(await as(bea).join(invite.code).expect(410))).toBe('INVITE_REVOKED');
    // Turning it off again changes nothing.
    await as(ada).revoke(invite.id).expect(204);

    const next = await inviteOf(ada, team.id);
    expect(next.id).not.toBe(invite.id);
    clock.advanceDays(7);
    expect(errorCode(await as(bea).preview(next.code).expect(410))).toBe('INVITE_EXPIRED');
    expect(errorCode(await as(bea).join(next.code).expect(410))).toBe('INVITE_EXPIRED');
    expect(await teamOf(bea)).toBeNull();
  });

  it('can be turned off by whoever made it or the owner — nobody else', async () => {
    const [ada, bea, cy, dan] = [
      await person('Ada'),
      await person('Bea'),
      await person('Cy'),
      await person('Dan'),
    ];
    const { team, invite } = await teamWith(ada, bea);
    // A teammate who did not make it, and someone outside the team.
    expect(errorCode(await as(bea).revoke(invite.id).expect(403))).toBe('FORBIDDEN');
    expect(errorCode(await as(dan).revoke(invite.id).expect(404))).toBe('NOT_FOUND');
    await as(dan).revoke('not-an-id').expect(404);

    // Bea's own invite: hers to turn off, and the owner's.
    clock.advanceDays(6.5);
    const beas = await inviteOf(bea, team.id);
    await as(ada).revoke(beas.id).expect(204);
    expect(errorCode(await as(cy).join(beas.code).expect(410))).toBe('INVITE_REVOKED');
  });

  it('is not given out by a full team, and not by outsiders', async () => {
    const [ada, bea, cy, dan] = [
      await person('Ada'),
      await person('Bea'),
      await person('Cy'),
      await person('Dan'),
    ];
    const { team } = await teamWith(ada, bea, cy);
    expect(errorCode(await as(ada).invite(team.id).expect(409))).toBe('TEAM_FULL');
    expect((await teamOf(ada))?.invite).toBeNull();
    expect(errorCode(await as(dan).invite(team.id).expect(404))).toBe('TEAM_NOT_FOUND');
    await as(dan).invite('not-an-id').expect(404);
  });
});

describe('joining', () => {
  it('lets friends in with a valid invite — everyone sees the same team', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    const { team, invite } = await teamWith(ada);
    const afterBea = await join(bea, invite.code);
    expect(names(afterBea)).toEqual(['Ada', 'Bea']);
    expect(afterBea.members[1]).toMatchObject({ userId: bea.id, role: 'member' });
    await join(cy, invite.code);

    for (const who of [ada, bea, cy]) {
      const seen = await teamOf(who);
      expect(seen?.id).toBe(team.id);
      expect(names(seen)).toEqual(['Ada', 'Bea', 'Cy']);
    }
    expect(logsOf('Team join').map((log) => log['outcome'])).toEqual(['joined', 'joined']);
  });

  it('keeps a full team at three', async () => {
    const [ada, bea, cy, dan] = [
      await person('Ada'),
      await person('Bea'),
      await person('Cy'),
      await person('Dan'),
    ];
    const { invite } = await teamWith(ada, bea, cy);
    const preview = InvitePreviewResponseSchema.parse(
      (await as(dan).preview(invite.code).expect(200)).body,
    ).preview;
    expect(preview).toMatchObject({ memberCount: 3, status: 'full' });
    expect(errorCode(await as(dan).join(invite.code).expect(409))).toBe('TEAM_FULL');
    expect(await t.prisma.teamMember.count()).toBe(3);
    expect(await teamOf(dan)).toBeNull();
    expect(logsOf('Team join').at(-1)).toMatchObject({
      userId: dan.id,
      outcome: 'rejected',
      reason: 'TEAM_FULL',
    });
  });

  it('says when the user is in this team already, or in another', async () => {
    const [ada, bea, eve] = [await person('Ada'), await person('Bea'), await person('Eve')];
    const { invite } = await teamWith(ada, bea);
    await createTeam(eve);

    const status = async (who: Person) =>
      InvitePreviewResponseSchema.parse((await as(who).preview(invite.code).expect(200)).body)
        .preview.status;
    expect(await status(bea)).toBe('alreadyMember');
    expect(await status(eve)).toBe('inAnotherTeam');
    expect(errorCode(await as(bea).join(invite.code).expect(409))).toBe('ALREADY_MEMBER');
    expect(errorCode(await as(eve).join(invite.code).expect(409))).toBe('ALREADY_IN_TEAM');
    expect(await t.prisma.teamMember.count()).toBe(3);
  });

  it('is for a challenge that has started', async () => {
    const [ada, fay] = [await person('Ada'), await person('Fay', { start: false })];
    const { invite } = await teamWith(ada);
    expect(errorCode(await as(fay).join(invite.code).expect(409))).toBe('CHALLENGE_NOT_STARTED');
  });
});

describe('the last place', () => {
  it('goes to exactly one of two people joining at the same moment — never a fourth', async () => {
    for (let round = 0; round < 5; round += 1) {
      await resetDatabase(t.prisma);
      const [ada, bea, cy, dan] = [
        await person('Ada'),
        await person('Bea'),
        await person('Cy'),
        await person('Dan'),
      ];
      const { team, invite } = await teamWith(ada, bea);
      const answers = await Promise.all([as(cy).join(invite.code), as(dan).join(invite.code)]);
      expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
      expect(answers.map(errorCode)).toContain('TEAM_FULL');
      expect(await t.prisma.teamMember.count({ where: { teamId: team.id } })).toBe(3);
      expect((await teamOf(ada))?.members).toHaveLength(3);
    }
  });

  it('takes two of ten joining at once', async () => {
    const ada = await person('Ada');
    const crowd: Person[] = [];
    for (let i = 0; i < 10; i += 1) crowd.push(await person(`Friend${i}`));
    const { team, invite } = await teamWith(ada);
    const answers = await Promise.all(crowd.map((who) => as(who).join(invite.code)));
    expect(answers.filter((answer) => answer.status === 200)).toHaveLength(2);
    expect(answers.filter((answer) => errorCode(answer) === 'TEAM_FULL')).toHaveLength(8);
    expect(await t.prisma.teamMember.count({ where: { teamId: team.id } })).toBe(3);
  });

  it('is held by the database too: three places per team, one team per person', async () => {
    const [ada, bea, cy, dan] = [
      await person('Ada'),
      await person('Bea'),
      await person('Cy'),
      await person('Dan'),
    ];
    const { team } = await teamWith(ada, bea, cy);
    // Past the service, straight into the table: a fourth place does not exist…
    await expect(
      t.prisma.teamMember.create({
        data: { teamId: team.id, userId: dan.id, slot: 4, role: 'member' },
      }),
    ).rejects.toThrow();
    // …a taken one cannot be taken twice, and nobody is in two teams.
    await expect(
      t.prisma.teamMember.create({
        data: { teamId: team.id, userId: dan.id, slot: 3, role: 'member' },
      }),
    ).rejects.toThrow();
    const other = await createTeam(dan);
    await expect(
      t.prisma.teamMember.create({
        data: { teamId: other.id, userId: bea.id, slot: 2, role: 'member' },
      }),
    ).rejects.toThrow();
    // And one owner per team.
    await expect(
      t.prisma.teamMember.update({
        where: { teamId_userId: { teamId: team.id, userId: bea.id } },
        data: { role: 'owner' },
      }),
    ).rejects.toThrow();
  });
});

describe('leaving', () => {
  it('leaves the team to the others', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    const { team } = await teamWith(ada, bea, cy);
    await as(bea).leave(team.id).expect(204);
    expect(await teamOf(bea)).toBeNull();
    expect(names(await teamOf(ada))).toEqual(['Ada', 'Cy']);
    expect(logsOf('Team left')).toEqual([
      expect.objectContaining({ teamId: team.id, userId: bea.id, members: 2, teamDeleted: false }),
    ]);
    // With a place free, a new invite works again.
    const invite = await inviteOf(ada, team.id);
    clock.advanceMinutes(10);
    await join(bea, invite.code);
    expect(names(await teamOf(cy))).toEqual(['Ada', 'Cy', 'Bea']);
  });

  it('hands an owner’s team to whoever joined earliest, and turns off the owner’s invites', async () => {
    const [ada, bea, cy, dan] = [
      await person('Ada'),
      await person('Bea'),
      await person('Cy'),
      await person('Dan'),
    ];
    const { team, invite } = await teamWith(ada, bea);
    clock.advanceMinutes(5);
    await join(cy, invite.code);
    await as(ada).leave(team.id).expect(204);

    const after = await teamOf(bea);
    expect(after?.members.map((member) => [member.displayName, member.role])).toEqual([
      ['Bea', 'owner'],
      ['Cy', 'member'],
    ]);
    expect(after?.name).toBe("Bea's team");
    expect(errorCode(await as(dan).join(invite.code).expect(410))).toBe('INVITE_REVOKED');
    expect(logsOf('Team left').at(-1)).toMatchObject({ ownerNow: bea.id });
  });

  it('deletes the team with its last member — invites and all', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    const { team } = await teamWith(ada, bea);
    await as(ada).leave(team.id).expect(204);
    await as(bea).leave(team.id).expect(204);
    expect(await t.prisma.team.count()).toBe(0);
    expect(await t.prisma.teamInvite.count()).toBe(0);
    expect(logsOf('Team left').at(-1)).toMatchObject({ teamDeleted: true, members: 0 });
    // Free to start again.
    await createTeam(bea);
  });

  it('is only for the team one is in', async () => {
    const [ada, dan] = [await person('Ada'), await person('Dan')];
    const { team } = await teamWith(ada);
    expect(errorCode(await as(dan).leave(team.id).expect(404))).toBe('TEAM_NOT_FOUND');
    await as(dan).leave('not-an-id').expect(404);
    expect(names(await teamOf(ada))).toEqual(['Ada']);
  });
});

describe('what members see of each other', () => {
  it('is a summary — never an email, answers or history', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    await teamWith(ada, bea);
    await sync(t.http, bea.session, playDay(1), 1);
    const response = await as(ada).me().expect(200);
    const text = JSON.stringify(response.body);
    for (const secret of ['@example.com', 'answers', 'optionId', 'passwordHash', 'questId']) {
      expect(text).not.toContain(secret);
    }
    const bee = MyTeamResponseSchema.parse(response.body).team?.members[1];
    expect(Object.keys(bee ?? {}).sort()).toEqual(
      Object.keys(TeamMemberSummarySchema.shape).sort(),
    );
  });

  it('is nothing at all to an outsider', async () => {
    const [ada, bea, dan] = [await person('Ada'), await person('Bea'), await person('Dan')];
    const { team } = await teamWith(ada, bea);
    expect(await teamOf(dan)).toBeNull();
    expect(errorCode(await as(dan).invite(team.id).expect(404))).toBe('TEAM_NOT_FOUND');
    expect(errorCode(await as(dan).leave(team.id).expect(404))).toBe('TEAM_NOT_FOUND');
    expect(names(await teamOf(ada))).toEqual(['Ada', 'Bea']);
  });
});

describe('the team’s progress', () => {
  it('follows each member’s day as the server records it', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    const { team } = await teamWith(ada, bea, cy);

    const adaDay = await sync(t.http, ada.session, playDay(1), 1);
    let seen = await teamOf(bea);
    expect(seen?.members[0]).toMatchObject({
      displayName: 'Ada',
      currentDay: 1,
      todayCompleted: true,
      todayQuestsDone: 4,
      streak: 1,
      totalXp: adaDay.progress?.challenge?.totalXp,
      daysCompleted: 1,
    });
    expect(seen?.members[0]?.totalXp).toBeGreaterThan(0);
    expect(seen?.members[1]).toMatchObject({ todayCompleted: false, todayQuestsDone: 0 });
    expect(seen?.streak).toEqual({ current: 0, longest: 0, todayComplete: false });

    await sync(t.http, bea.session, playDay(1), 1);
    seen = await teamOf(cy);
    expect(seen?.members.filter((member) => member.todayCompleted)).toHaveLength(2);
    expect(seen?.streak.todayComplete).toBe(false);

    await sync(t.http, cy.session, playDay(1), 1);
    expect((await teamOf(ada))?.streak).toEqual({ current: 1, longest: 1, todayComplete: true });

    // The next day is open: yesterday still counts, today is nobody's yet.
    clock.advanceDays(1);
    seen = await teamOf(ada);
    expect(seen?.streak).toEqual({ current: 1, longest: 1, todayComplete: false });
    expect(seen?.members.map((member) => [member.currentDay, member.todayCompleted])).toEqual([
      [2, false],
      [2, false],
      [2, false],
    ]);
    for (const who of [ada, bea, cy]) await sync(t.http, who.session, playDay(2), 5);
    expect((await teamOf(bea))?.streak).toEqual({ current: 2, longest: 2, todayComplete: true });
    expect(team.id).toBe((await teamOf(cy))?.id);
  });

  it('counts a member from the day they join, on their own challenge day', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    const { invite } = await teamWith(ada, bea);
    for (const who of [ada, bea]) await sync(t.http, who.session, playDay(1), 1);

    // Cy starts a day later, and joins then: Cy's Day 1 is the team's second day.
    clock.advanceDays(1);
    const cy = await person('Cy', { startDate: '2026-09-02' });
    await join(cy, invite.code);
    for (const who of [ada, bea]) await sync(t.http, who.session, playDay(2), 5);
    let seen = await teamOf(ada);
    expect(seen?.members.map((member) => member.currentDay)).toEqual([2, 2, 1]);
    // Everyone but Cy: today is not a team day yet.
    expect(seen?.streak).toEqual({ current: 1, longest: 1, todayComplete: false });

    await sync(t.http, cy.session, playDay(1), 1);
    seen = await teamOf(ada);
    expect(seen?.streak).toEqual({ current: 2, longest: 2, todayComplete: true });
  });

  it('takes XP from the server’s records — a device cannot claim more', async () => {
    const [ada, bea] = [await person('Ada'), await person('Bea')];
    await teamWith(ada, bea);
    // A device claiming a reward of its own: the request is not even valid.
    const [first] = playDay(1);
    await request(t.http)
      .post('/api/v1/progress/sync')
      .set('Authorization', bearer(bea.session))
      .send({
        userId: bea.id,
        courseId: 'milo-english-90',
        courseVersion: 1,
        knownRevision: 1,
        mutations: [{ ...first, payload: { ...first?.payload, xpEarned: 99_999 } }],
      })
      .expect(400);
    const played = await sync(t.http, bea.session, playDay(1), 1);
    const bee = (await teamOf(ada))?.members[1];
    expect(bee?.totalXp).toBe(played.progress?.challenge?.totalXp);
    expect(bee?.totalXp).toBeLessThan(1000);
  });
});

describe('the Team Streak badge', () => {
  /**
   * Days 3–6 of the course have no content yet: the server's records of them
   * are put in place as a finished day leaves them. Days 1, 2 and 7 are played.
   */
  async function recordDays(who: Person, days: number[]) {
    const challenge = await t.prisma.userChallenge.findFirstOrThrow({ where: { userId: who.id } });
    const recorded = await t.prisma.dayCompletion.count({ where: { challengeId: challenge.id } });
    await t.prisma.dayCompletion.createMany({
      data: days.map((day, index) => ({
        challengeId: challenge.id,
        day,
        questCount: 4,
        xpEarned: 60,
        streakBefore: recorded + index,
        streakAfter: recorded + index + 1,
        isPerfect: false,
        completedAt: new Date(`2026-09-0${day}T12:00:00.000Z`),
      })),
    });
  }

  const badgeOf = async (who: Person) =>
    t.prisma.achievementUnlock.findMany({
      where: { achievementId: 'teamStreak', challenge: { userId: who.id } },
    });

  it('unlocks for every member once the team finishes seven days in a row — once each', async () => {
    const [ada, bea, cy] = [await person('Ada'), await person('Bea'), await person('Cy')];
    await teamWith(ada, bea, cy);
    const revisions = new Map<string, number>();
    const play = async (who: Person, day: number) => {
      const response = await sync(t.http, who.session, playDay(day), revisions.get(who.id) ?? 1);
      revisions.set(who.id, response.revision);
      return response;
    };
    for (const who of [ada, bea, cy]) await play(who, 1);
    clock.advanceDays(1);
    for (const who of [ada, bea, cy]) await play(who, 2);
    for (const who of [ada, bea, cy]) await recordDays(who, [3, 4, 5, 6]);
    clock.advanceDays(5);

    // Day 7: six team days behind them, today open — locked for everyone.
    expect((await teamOf(ada))?.streak).toEqual({ current: 6, longest: 6, todayComplete: false });
    await play(ada, 7);
    await play(bea, 7);
    expect(await badgeOf(ada)).toEqual([]);
    expect(await badgeOf(bea)).toEqual([]);

    // Cy's last quest completes the seventh team day: Cy's own sync unlocks it…
    const cys = await play(cy, 7);
    expect(cys.progress?.achievementUnlocks.map((unlock) => unlock.achievementId)).toContain(
      'teamStreak',
    );
    expect(cys.progress?.xpEvents).toContainEqual(
      expect.objectContaining({ reason: 'achievement', refId: 'teamStreak', amount: 100 }),
    );
    expect((await teamOf(cy))?.streak).toEqual({ current: 7, longest: 7, todayComplete: true });

    // …and Ada and Bea get it with their next sync, nothing to send.
    const adas = await sync(t.http, ada.session, [], revisions.get(ada.id));
    expect(adas.revision).toBe((revisions.get(ada.id) ?? 0) + 1);
    expect(adas.progress?.achievementUnlocks.map((unlock) => unlock.achievementId)).toContain(
      'teamStreak',
    );
    await sync(t.http, bea.session, [], revisions.get(bea.id));
    for (const who of [ada, bea, cy]) {
      expect(await badgeOf(who)).toHaveLength(1);
    }
    expect(
      await t.prisma.xpLedgerEntry.count({ where: { reason: 'achievement', refId: 'teamStreak' } }),
    ).toBe(3);
    expect(logsOf('Team badge')).toHaveLength(2);

    // Once: more syncs change nothing.
    const again = await sync(t.http, ada.session, [], adas.revision);
    expect(again.revision).toBe(adas.revision);
    expect(again.progress).toBeNull();
    expect(await badgeOf(ada)).toHaveLength(1);
  });

  it('is never earned alone, whatever the streak', async () => {
    const ada = await person('Ada');
    await createTeam(ada);
    await sync(t.http, ada.session, playDay(1), 1);
    clock.advanceDays(1);
    await sync(t.http, ada.session, playDay(2), 5);
    await recordDays(ada, [3, 4, 5, 6]);
    clock.advanceDays(5);
    const response = await sync(t.http, ada.session, playDay(7), 9);
    expect(response.progress?.dayCompletions.map((day) => day.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await badgeOf(ada)).toEqual([]);
  });
});

describe('rate limiting', () => {
  let limited: TestApp;
  beforeAll(async () => {
    limited = await startApp({ env: { INVITE_RATE_LIMIT: '3' } });
  });
  afterAll(() => limited.close());

  it('limits invite guesses per account', async () => {
    await resetDatabase(limited.prisma);
    const guesser = await register(limited.http, 'guesser@example.com');
    const other = await register(limited.http, 'other@example.com');
    const guess = (session: AuthSession) =>
      request(limited.http)
        .post('/api/v1/team-invites/preview')
        .set('Authorization', bearer(session))
        .send({ code: 'AAAAA-AAAAA' });
    for (let i = 0; i < 3; i += 1) await guess(guesser).expect(404);
    const blocked = await guess(guesser).expect(429);
    expect(errorCode(blocked)).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after-invites'])).toBeGreaterThan(0);
    // Another account is not held back by it.
    await guess(other).expect(404);
  });
});
