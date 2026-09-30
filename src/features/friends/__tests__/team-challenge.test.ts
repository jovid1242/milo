import { FakeTeamServer } from '@/data/repositories/api/__fixtures__/fake-team-server';
import { LOCAL_SELF_ID } from '@/data/repositories/local/local-friends-repository';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import type { ProgressSync, Repositories } from '@/data/repositories/types';
import {
  loadAchievements,
  loadPendingCelebrations,
  syncAchievements,
} from '@/features/achievements/use-cases';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import type { InviteCode, TeamMemberSummary, TeamSnapshot } from '@/schemas';

import { inviteShareMessage } from '../logic/team-copy';
import { TEAM_PROBLEMS, teamProblemOf, type TeamProblem } from '../logic/team-errors';
import {
  createTeam,
  joinTeam,
  leaveTeam,
  loadFriends,
  loadMemberDetails,
  previewInvite,
  refreshTeam,
  renewInvite,
  teamInvite,
  type FriendsState,
} from '../use-cases';

/**
 * The team from the app's side: its use cases and repository against a
 * stand-in for the Milo API (the real one is tested in server/test), each
 * account with its own cache.
 */

const ADA = '00000000-0000-4000-8000-00000000ada0';
const BEA = '00000000-0000-4000-8000-00000000bea0';
const CY = '00000000-0000-4000-8000-000000000c00';
const DAN = '00000000-0000-4000-8000-00000000da00';

let server: FakeTeamServer;

beforeEach(() => {
  server = new FakeTeamServer();
  for (const [id, name] of [
    [ADA, 'Ada'],
    [BEA, 'Bea'],
    [CY, 'Cy'],
    [DAN, 'Dan'],
  ] as const)
    server.names.set(id, name);
});

/** An account on its phone, Day `day` of the challenge. */
function account(userId: string, day = 5) {
  return createMemoryRepositories(getStartDateForDay(day, new Date()), {
    team: { api: server.api(() => userId), selfId: userId },
  });
}

const problemOf = async (work: Promise<unknown>): Promise<TeamProblem> => {
  try {
    await work;
  } catch (error) {
    return teamProblemOf(error);
  }
  throw new Error('It worked');
};

const viewOf = (state: FriendsState) => {
  if (state.kind !== 'team') throw new Error(`No team: ${state.kind}`);
  return state.view;
};

async function adasTeam() {
  const ada = account(ADA);
  const made = await createTeam(ada);
  const invite = await teamInvite(ada, made.team?.id ?? '');
  return { ada, teamId: made.team?.id ?? '', code: invite.code };
}

describe('no team', () => {
  it('knows nothing before the first answer, then that there is no team', async () => {
    const ada = account(ADA);
    expect(await loadFriends(ada)).toEqual({ kind: 'unknown', serverBacked: true });
    await refreshTeam(ada);
    expect(await loadFriends(ada)).toMatchObject({ kind: 'noTeam', serverBacked: true });
  });
});

describe('making a team', () => {
  it('makes the user its owner and only member: 1/3', async () => {
    const ada = account(ADA);
    await createTeam(ada);
    const view = viewOf(await loadFriends(ada));
    expect(view).toMatchObject({ name: "Ada's team", capacity: 3, isFull: false });
    expect(view.members).toEqual([
      expect.objectContaining({ userId: ADA, isCurrentUser: true, isOwner: true }),
    ]);
  });

  it('shares an invite with a short message, the link and the code', async () => {
    const { ada, code } = await adasTeam();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    const message = inviteShareMessage(code);
    expect(message).toContain(`milo://invite/${code}`);
    expect(message).toContain(`code ${code}`);
    // The team shows it too, from the cache — until it ends.
    expect(viewOf(await loadFriends(ada)).invite?.code).toBe(code);
  });

  it('turns an invite off for a new one', async () => {
    const { ada, teamId, code } = await adasTeam();
    const invite = viewOf(await loadFriends(ada)).invite;
    const fresh = await renewInvite(ada, { teamId, inviteId: invite?.id ?? '' });
    expect(fresh.code).not.toBe(code);
    expect(await problemOf(previewInvite(account(BEA), code))).toBe('revoked');
  });
});

describe('joining with a code', () => {
  it('shows the team first, then joins it — and everyone sees the same members', async () => {
    const { ada, code } = await adasTeam();
    const bea = account(BEA);
    await expect(previewInvite(bea, code)).resolves.toMatchObject({
      teamName: "Ada's team",
      ownerName: 'Ada',
      memberCount: 1,
      capacity: 3,
      status: 'canJoin',
    });
    // Previewing is not joining.
    await refreshTeam(bea);
    expect((await loadFriends(bea)).kind).toBe('noTeam');

    await joinTeam(bea, code);
    const cy = account(CY);
    await joinTeam(cy, code);
    for (const who of [ada, bea, cy]) {
      await refreshTeam(who);
      const view = viewOf(await loadFriends(who));
      expect(view.members.map((member) => member.userId).sort()).toEqual([ADA, BEA, CY].sort());
      expect(view.isFull).toBe(true);
    }
  });

  it('says why a code does not work: full, expired, turned off, wrong, already in', async () => {
    const { ada, code } = await adasTeam();
    await joinTeam(account(BEA), code);
    await joinTeam(account(CY), code);
    const dan = account(DAN);
    await expect(previewInvite(dan, code)).resolves.toMatchObject({ status: 'full' });
    expect(await problemOf(joinTeam(dan, code))).toBe('full');
    expect(await problemOf(joinTeam(dan, 'AAAAA-AAAAA' as InviteCode))).toBe('invalid');
    expect(await problemOf(joinTeam(account(BEA), code))).toBe('alreadyMember');

    const second = await adasTeamFor(DAN);
    server.expire(second.code);
    expect(await problemOf(previewInvite(account(CY), second.code))).toBe('expired');
    expect(await problemOf(createTeam(ada))).toBe('inAnotherTeam');
    for (const problem of ['full', 'expired', 'revoked', 'invalid'] as const) {
      expect(TEAM_PROBLEMS[problem].title).not.toMatch(/500|error/i);
    }
  });
});

/** Another team, made by `userId`. */
async function adasTeamFor(userId: string) {
  const owner = account(userId);
  const made = await createTeam(owner);
  const invite = await teamInvite(owner, made.team?.id ?? '');
  return { owner, code: invite.code };
}

describe('offline', () => {
  it('shows the last known team, and needs a connection to change it', async () => {
    const { ada, teamId, code } = await adasTeam();
    await joinTeam(account(BEA), code);
    await refreshTeam(ada);
    const before = viewOf(await loadFriends(ada));

    server.offline = true;
    expect(await problemOf(refreshTeam(ada))).toBe('offline');
    const offline = viewOf(await loadFriends(ada));
    expect(offline.members.map((member) => member.userId)).toEqual([ADA, BEA]);
    expect(offline.asOf).toBe(before.asOf);

    for (const work of [
      teamInvite(ada, teamId),
      leaveTeam(ada, teamId),
      createTeam(ada),
      joinTeam(ada, code),
      previewInvite(ada, code),
    ]) {
      expect(await problemOf(work)).toBe('offline');
    }
    expect(TEAM_PROBLEMS.offline.title).toBe('Internet connection required');
    // Still the team, untouched: nothing was changed or queued offline.
    expect(viewOf(await loadFriends(ada)).members).toHaveLength(2);

    server.offline = false;
    await leaveTeam(ada, teamId);
    expect((await loadFriends(ada)).kind).toBe('noTeam');
  });
});

describe('accounts', () => {
  it('keep their teams apart: B never sees A’s', async () => {
    const { ada } = await adasTeam();
    const bea = account(BEA);
    expect((await loadFriends(bea)).kind).toBe('unknown');
    await refreshTeam(bea);
    expect((await loadFriends(bea)).kind).toBe('noTeam');
    expect(viewOf(await loadFriends(ada)).members).toHaveLength(1);
  });

  it('refuse an answer that is not the account’s own', async () => {
    const { code } = await adasTeam();
    // A session that changed underneath: the server answers as Ada, the cache is Bea's.
    const confused = createMemoryRepositories(getStartDateForDay(5, new Date()), {
      team: { api: server.api(() => ADA), selfId: BEA },
    });
    await expect(refreshTeam(confused)).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect((await loadFriends(confused)).kind).toBe('unknown');
    expect(code).toBeTruthy();
  });
});

describe('a teammate’s card', () => {
  it('shows the server’s summary of them — their day, streak and XP', async () => {
    const { ada, code } = await adasTeam();
    await joinTeam(account(BEA), code);
    server.progress.set(BEA, { currentDay: 4, streak: 3, totalXp: 320, todayQuestsDone: 2 });
    await refreshTeam(ada);
    const details = await loadMemberDetails(ada, BEA);
    expect(details?.member).toMatchObject({
      displayName: 'Bea',
      currentDay: 4,
      streak: 3,
      totalXp: 320,
      todayQuestsDone: 2,
      isCurrentUser: false,
    });
    expect(await loadMemberDetails(ada, DAN)).toBeNull();
  });
});

/** A team of the user and Bea, `streak` team days long, as the last answer. */
function twoOf(selfId: string, streak: number): TeamSnapshot {
  const member = (userId: string, role: 'owner' | 'member'): TeamMemberSummary => ({
    userId,
    displayName: userId === BEA ? 'Bea' : 'Ada',
    avatarUrl: null,
    role,
    joinedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    currentDay: 5,
    todayCompleted: false,
    todayQuestsDone: 0,
    streak: 4,
    totalXp: 300,
    daysCompleted: 4,
    achievementsUnlocked: 2,
    lastActivityAt: null,
  });
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    name: "Ada's team",
    capacity: 3,
    createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    members: [member(selfId, 'owner'), member(BEA, 'member')],
    streak: { current: streak, longest: streak, todayComplete: false },
    invite: null,
  };
}

describe('the Team Streak badge on the phone', () => {
  const asAccount = (repositories: Repositories): Repositories => ({
    ...repositories,
    // An account: its badges go through the server (the engine is not needed here).
    sync: { requestSync: () => undefined } as unknown as ProgressSync,
  });

  it('shows the team’s progress toward it — and is never unlocked by the phone', async () => {
    const ada = account(ADA);
    await ada.store.team.write({ team: twoOf(ADA, 8), asOf: new Date().toISOString() });
    const badge = (await loadAchievements(asAccount(ada))).find(
      (status) => status.achievement.id === 'teamStreak',
    );
    expect(badge).toMatchObject({ state: 'locked', progress: { current: 7, target: 7 } });
    await expect(syncAchievements(asAccount(ada))).resolves.toEqual([]);
    await expect(ada.achievements.getUnlocks()).resolves.toEqual([]);
  });

  it('is not available without a team to share it with', async () => {
    const badge = (await loadAchievements(account(ADA))).find(
      (status) => status.achievement.id === 'teamStreak',
    );
    expect(badge?.state).toBe('notAvailable');
  });

  it('in local mode (a demo team, no server) is the phone’s own to unlock — once', async () => {
    const local = createMemoryRepositories(getStartDateForDay(5, new Date()));
    await local.store.team.write({ team: twoOf(LOCAL_SELF_ID, 7), asOf: new Date().toISOString() });
    const unlocked = await syncAchievements(local);
    expect(unlocked.map((achievement) => achievement.id)).toContain('teamStreak');
    await expect(syncAchievements(local)).resolves.toEqual([]);
    const pending = await loadPendingCelebrations(local);
    expect(pending.filter((achievement) => achievement.id === 'teamStreak')).toHaveLength(1);
  });
});

describe('local mode', () => {
  it('has no teams to make or join — and says so', async () => {
    const local = createMemoryRepositories(getStartDateForDay(5, new Date()));
    expect(await loadFriends(local)).toEqual({ kind: 'unknown', serverBacked: false });
    expect(await problemOf(createTeam(local))).toBe('unavailable');
    expect(await problemOf(joinTeam(local, '7K2PX-9QDMA'))).toBe('unavailable');
  });
});
