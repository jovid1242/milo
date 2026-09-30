import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ApiFriendsRepository } from '@/data/repositories/api/api-friends-repository';
import { SqliteTeamCache } from '@/data/repositories/local/sqlite-team-cache';
import { loadPendingCelebrations, markCelebrated } from '@/features/achievements/use-cases';
import { teamProblemOf } from '@/features/friends/logic/team-errors';
import {
  createTeam,
  joinTeam,
  leaveTeam,
  loadFriends,
  previewInvite,
  refreshTeam,
  teamInvite,
  type FriendsState,
} from '@/features/friends/use-cases';
import { startChallenge } from '@/features/onboarding/use-cases';
import type { OwnerSession } from '@/services/session/owner-session';

import { resetDatabase, startApp, type TestApp } from './helpers';
import { Phone } from './phone';

/**
 * The app's own team code — its repository, its account-scoped cache, its
 * use cases — on phones talking to this server: three friends make a team,
 * a fourth finds it full, a phone offline shows what it knew, and one
 * account's team never shows up under another.
 */

let t: TestApp;
beforeAll(async () => {
  t = await startApp({ listen: true });
});
afterAll(() => t.close());

const phones: Phone[] = [];
const phone = () => {
  const created = new Phone(t.baseUrl);
  phones.push(created);
  return created;
};

beforeEach(async () => {
  await resetDatabase(t.prisma);
});
afterEach(async () => {
  for (const item of phones.splice(0)) await item.close();
});

/** A new account through onboarding, on its own phone. */
async function friend(name: string): Promise<{ device: Phone; session: OwnerSession }> {
  const device = phone();
  const session = await device.signUp(`${name.toLowerCase()}@example.com`);
  await startChallenge(session.repositories, { displayName: name, goal: 'habit' });
  await device.auth.updateProfile({ displayName: name });
  await session.engine!.requestSync('manual');
  return { device, session };
}

const failure = async (work: Promise<unknown>) => {
  try {
    await work;
  } catch (error) {
    return teamProblemOf(error);
  }
  throw new Error('It worked');
};

const teamView = (state: FriendsState) => {
  if (state.kind !== 'team') throw new Error(`No team: ${state.kind}`);
  return state.view;
};

/** Ada's team on Ada's phone, with an invite to share. */
async function adasTeam() {
  const ada = await friend('Ada');
  const made = await createTeam(ada.session.repositories);
  const teamId = made.team?.id ?? '';
  const invite = await teamInvite(ada.session.repositories, teamId);
  return { ada, teamId, code: invite.code };
}

describe('three friends', () => {
  it('make a team from their phones, and all see the same one — a fourth finds it full', async () => {
    const { ada, code } = await adasTeam();
    const [bea, cy, dan] = [await friend('Bea'), await friend('Cy'), await friend('Dan')];

    await expect(previewInvite(bea.session.repositories, code)).resolves.toMatchObject({
      teamName: "Ada's team",
      ownerName: 'Ada',
      memberCount: 1,
      status: 'canJoin',
    });
    await joinTeam(bea.session.repositories, code);
    await joinTeam(cy.session.repositories, code);
    expect(await failure(joinTeam(dan.session.repositories, code))).toBe('full');
    await refreshTeam(dan.session.repositories);
    expect((await loadFriends(dan.session.repositories)).kind).toBe('noTeam');

    const seen = [];
    for (const who of [ada, bea, cy]) {
      await refreshTeam(who.session.repositories);
      const view = teamView(await loadFriends(who.session.repositories));
      expect(view.members).toHaveLength(3);
      expect(view.isFull).toBe(true);
      // Everyone sees themselves first.
      expect(view.members[0]?.isCurrentUser).toBe(true);
      seen.push(view.members.map((member) => member.displayName).sort());
    }
    expect(seen).toEqual([
      ['Ada', 'Bea', 'Cy'],
      ['Ada', 'Bea', 'Cy'],
      ['Ada', 'Bea', 'Cy'],
    ]);
  });
});

describe('offline', () => {
  it('shows the last team it heard of — and asks for a connection to change it', async () => {
    const { ada, teamId, code } = await adasTeam();
    const bea = await friend('Bea');
    await joinTeam(bea.session.repositories, code);
    await refreshTeam(ada.session.repositories);
    const before = teamView(await loadFriends(ada.session.repositories));

    ada.device.online = false;
    expect(await failure(refreshTeam(ada.session.repositories))).toBe('offline');
    const offline = teamView(await loadFriends(ada.session.repositories));
    expect(offline.members.map((member) => member.displayName)).toEqual(['Ada', 'Bea']);
    expect(offline.asOf).toBe(before.asOf);
    expect(await failure(teamInvite(ada.session.repositories, teamId))).toBe('offline');
    expect(await failure(leaveTeam(ada.session.repositories, teamId))).toBe('offline');
    expect(await failure(createTeam(ada.session.repositories))).toBe('offline');
    // Nothing waits to be sent: the progress outbox holds no team action.
    await expect(ada.session.repositories.sync!.repository.outbox()).resolves.toEqual([]);

    ada.device.online = true;
    await leaveTeam(ada.session.repositories, teamId);
    expect((await loadFriends(ada.session.repositories)).kind).toBe('noTeam');
    await refreshTeam(bea.session.repositories);
    const beas = teamView(await loadFriends(bea.session.repositories));
    expect(beas.members.map((member) => [member.displayName, member.isOwner])).toEqual([
      ['Bea', true],
    ]);
  });
});

describe('one phone, two accounts', () => {
  it('never shows one account’s team to the other', async () => {
    const { ada } = await adasTeam();
    await ada.device.signOut(ada.session);
    await friend('Bea').then(({ device, session }) => device.signOut(session));

    // Bea signs in on Ada's phone: nothing of Ada's team, not even from the cache.
    const beaHere = await ada.device.signIn('bea@example.com');
    expect((await loadFriends(beaHere.repositories)).kind).toBe('unknown');
    await refreshTeam(beaHere.repositories);
    expect((await loadFriends(beaHere.repositories)).kind).toBe('noTeam');

    // An answer for another account than the cache's owner is never kept.
    const adaId = (await t.prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } }))
      .id;
    await ada.device.signOut(beaHere);
    const adaBack = await ada.device.signIn('ada@example.com');
    const wrongCache = new SqliteTeamCache(ada.device.store, beaHere.owner);
    const confused = new ApiFriendsRepository(
      ada.device.services.teamApi!,
      wrongCache,
      beaHere.owner,
    );
    await expect(confused.refresh()).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect((await wrongCache.read())?.team).toBeNull();

    // Ada is back: her team, even before asking the server.
    const view = teamView(await loadFriends(adaBack.repositories));
    expect(view.members.map((member) => member.userId)).toEqual([adaId]);
  });
});

describe('the Team Streak badge', () => {
  it('arrives by sync when the team’s seventh day is done — celebrated once, on a phone that follows the account', async () => {
    const { ada, code } = await adasTeam();
    const [bea, cy] = [await friend('Bea'), await friend('Cy')];
    await joinTeam(bea.session.repositories, code);
    await joinTeam(cy.session.repositories, code);

    // A week ago the three of them started together, and finished every day since.
    const day = 24 * 60 * 60 * 1000;
    const weekAgo = new Date(Date.now() - 7 * day);
    const startDate = new Date(`${weekAgo.toISOString().slice(0, 10)}T00:00:00.000Z`);
    await t.prisma.userChallenge.updateMany({ data: { startDate } });
    await t.prisma.teamMember.updateMany({ data: { joinedAt: weekAgo } });
    for (const challenge of await t.prisma.userChallenge.findMany()) {
      await t.prisma.dayCompletion.createMany({
        data: [1, 2, 3, 4, 5, 6, 7].map((number) => ({
          challengeId: challenge.id,
          day: number,
          questCount: 4,
          xpEarned: 60,
          streakBefore: number - 1,
          streakAfter: number,
          isPerfect: false,
          completedAt: new Date(startDate.getTime() + (number - 1) * day + 12 * 60 * 60 * 1000),
        })),
      });
    }

    // Cy's phone has followed the account all along: the badge is news there.
    await cy.session.engine!.requestSync('foreground');
    const pending = await loadPendingCelebrations(cy.session.repositories);
    expect(pending.map((achievement) => achievement.id)).toEqual(['teamStreak']);
    await markCelebrated(cy.session.repositories, ['teamStreak']);
    await cy.session.engine!.requestSync('foreground');
    await expect(loadPendingCelebrations(cy.session.repositories)).resolves.toEqual([]);
    const unlocks = await cy.session.repositories.achievements.getUnlocks();
    expect(unlocks.filter((unlock) => unlock.achievementId === 'teamStreak')).toHaveLength(1);

    // A phone Ada signs in on for the first time gets it as history: no celebration there.
    const fresh = phone();
    const adaFresh = await fresh.signIn('ada@example.com');
    expect(
      (await adaFresh.repositories.achievements.getUnlocks()).map((unlock) => unlock.achievementId),
    ).toContain('teamStreak');
    await expect(loadPendingCelebrations(adaFresh.repositories)).resolves.toEqual([]);
    expect(await t.prisma.achievementUnlock.count({ where: { achievementId: 'teamStreak' } })).toBe(
      2,
    );
    expect(ada.session.owner).not.toBe(cy.session.owner);
  });
});
