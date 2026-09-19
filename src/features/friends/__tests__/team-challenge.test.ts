import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { loadAchievements, syncAchievements } from '@/features/achievements/use-cases';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { completeQuest } from '@/features/progress/use-cases';
import type { QuestCompletion, Team, TeamMember } from '@/schemas';

import {
  createInvite,
  joinTeam,
  loadMemberDetails,
  loadTeamActivity,
  loadTeamView,
  pickTeamActivity,
} from '../use-cases';

type Repositories = ReturnType<typeof createMemoryRepositories>;
const AT = '2026-09-18T10:00:00.000Z';
const TEAM: Team = { id: 'team-1', name: 'Our team', inviteCode: 'MILO-7K2P', createdAt: AT };

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

function friend(id: string, days: number[], patch: Partial<TeamMember> = {}): TeamMember {
  return {
    id,
    displayName: id[0]?.toUpperCase() + id.slice(1),
    avatarUrl: null,
    joinedDay: 1,
    completedDays: days,
    today: null,
    totalXp: 1200,
    achievementsUnlocked: 4,
    lastActivityAt: AT,
    ...patch,
  };
}

async function setup(currentDay: number) {
  return createMemoryRepositories(getStartDateForDay(currentDay, new Date()));
}

/** The user's own finished days, stored as quest completions. */
async function myDays(repositories: Repositories, days: readonly number[]) {
  const plans = await repositories.challenge.getDailyChallenges();
  const completions: QuestCompletion[] = plans
    .filter((plan) => days.includes(plan.day))
    .flatMap((plan) =>
      plan.quests.map((quest) => ({
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: 5 / 6,
        correctCount: 5,
        totalCount: 6,
        xpEarned: quest.xpReward,
        source: 'user' as const,
        completedAt: AT,
      })),
    );
  await repositories.dev?.seedHistory(completions, [], [], []);
}

/** The rest of today's quests, through the real completion use case. */
async function finishToday(repositories: Repositories, day: number) {
  const plan = await repositories.challenge.getDailyChallenge(day);
  const done = new Set((await repositories.progress.getCompletions()).map((c) => c.questId));
  const outcomes = [];
  for (const quest of plan.quests.filter((item) => !done.has(item.id))) {
    outcomes.push(
      await completeQuest(repositories, { questId: quest.id, correctCount: 5, totalCount: 6 }),
    );
  }
  return outcomes;
}

const teamStreakBadge = async (repositories: Repositories) =>
  (await loadAchievements(repositories)).find((status) => status.achievement.id === 'teamStreak');

describe('team challenge', () => {
  it('has no team until the user creates an invite', async () => {
    const repositories = await setup(5);
    expect(await loadTeamView(repositories)).toBeNull();
    expect(await teamStreakBadge(repositories)).toMatchObject({ state: 'notAvailable' });
  });

  it('updates team progress when the user finishes their day', async () => {
    const repositories = await setup(20);
    await myDays(repositories, range(1, 19));
    await repositories.dev?.replaceTeam(
      TEAM,
      [friend('alex', range(1, 20)), friend('mia', range(1, 20))],
      [],
    );
    const before = await loadTeamView(repositories);
    expect(before).toMatchObject({ finishedToday: 2, isTeamDayComplete: false, teamStreak: 19 });

    await finishToday(repositories, 20);
    const after = await loadTeamView(repositories);
    expect(after).toMatchObject({ finishedToday: 3, isTeamDayComplete: true, teamStreak: 20 });
    expect(after?.members[0]).toMatchObject({ id: 'me', status: 'done', isCurrentUser: true });
  });

  it('unlocks Team Streak on the 7th team day in a row — and keeps it after a break', async () => {
    const repositories = await setup(7);
    await myDays(repositories, range(1, 6));
    await repositories.dev?.replaceTeam(
      TEAM,
      [friend('alex', range(1, 7)), friend('mia', range(1, 7))],
      [],
    );
    await syncAchievements(repositories);
    expect(await teamStreakBadge(repositories)).toMatchObject({
      state: 'locked',
      progress: { current: 6, target: 7 },
    });

    // The user finishes Day 7: everyone has now finished 7 days in a row.
    const outcomes = await finishToday(repositories, 7);
    const unlocked = outcomes.flatMap((outcome) => outcome.newAchievements.map((a) => a.id));
    expect(unlocked).toContain('teamStreak');

    // Days later, the team streak is broken — the badge stays.
    await repositories.user.updateChallengeStartDate(getStartDateForDay(12, new Date()));
    expect((await loadTeamView(repositories))?.teamStreak).toBe(0);
    expect(await teamStreakBadge(repositories)).toMatchObject({ state: 'unlocked' });
    expect(await syncAchievements(repositories)).toEqual([]);
  });

  it('shows a friend without private stats as unknown, never as 0', async () => {
    const repositories = await setup(20);
    await repositories.dev?.replaceTeam(
      TEAM,
      [
        friend('mia', range(1, 19), {
          totalXp: null,
          achievementsUnlocked: null,
          lastActivityAt: null,
          today: null,
        }),
      ],
      [],
    );
    const details = await loadMemberDetails(repositories, 'mia');
    expect(details?.member).toMatchObject({
      totalXp: null,
      achievementsUnlocked: null,
      lastActivityAt: null,
      todayQuestsDone: null,
      status: 'unknown',
      journeyDays: 19,
    });
  });

  it('creates a demo invite that never pretends someone can join remotely', async () => {
    const repositories = await setup(3);
    const invite = await createInvite(repositories, new Date(AT));
    expect(invite).toMatchObject({ joinable: false });
    expect(invite.code).toMatch(/^MILO-[A-HJ-NP-Z2-9]{4}$/);
    // The same team (and code) on every later call.
    expect((await createInvite(repositories)).code).toBe(invite.code);
    expect((await loadTeamView(repositories))?.members.map((m) => m.id)).toEqual(['me']);

    expect(await joinTeam(repositories, invite.code.toLowerCase())).toEqual({
      status: 'alreadyMember',
    });
    expect(await joinTeam(repositories, 'MILO-ABCD')).toEqual({ status: 'unavailable' });
    expect(await joinTeam(repositories, 'nope')).toEqual({ status: 'invalidCode' });
  });

  it('merges the user’s own moments with the team’s, newest first, capped', async () => {
    const repositories = await setup(3);
    await repositories.dev?.replaceTeam(
      { ...TEAM, createdAt: '2026-01-01T00:00:00.000Z' },
      [friend('alex', range(1, 2))],
      [
        {
          id: 'a1',
          memberId: 'alex',
          type: 'dayCompleted',
          metadata: { day: 2 },
          createdAt: '2026-01-02T09:00:00.000Z',
        },
      ],
    );
    await finishToday(repositories, 1);
    const activity = await loadTeamActivity(repositories);
    expect(activity.map((event) => event.type)).toEqual(
      expect.arrayContaining(['dayCompleted', 'achievementUnlocked']),
    );
    expect(activity.some((event) => event.memberId === 'me')).toBe(true);
    expect(activity.length).toBeLessThanOrEqual(5);
    const times = activity.map((event) => event.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('keeps recent activity balanced: at most two moments per member', () => {
    const at = (minutes: number) => new Date(Date.parse(AT) - minutes * 60_000).toISOString();
    const events = [
      ...[1, 2, 3, 4].map((n) => ({
        id: `me-${n}`,
        memberId: 'me',
        type: 'dayCompleted' as const,
        metadata: { day: n },
        createdAt: at(n),
      })),
      { id: 'a', memberId: 'alex', type: 'memberJoined' as const, metadata: {}, createdAt: at(30) },
      { id: 'm', memberId: 'mia', type: 'memberJoined' as const, metadata: {}, createdAt: at(60) },
    ];
    expect(pickTeamActivity(events, { limit: 5, perMember: 2 }).map((e) => e.id)).toEqual([
      'me-1',
      'me-2',
      'a',
      'm',
    ]);
  });

  it('reads the team back the same way — as after a restart', async () => {
    const repositories = await setup(20);
    await repositories.dev?.replaceTeam(TEAM, [friend('alex', range(1, 19))], []);
    const first = await loadTeamView(repositories);
    const again = await loadTeamView(repositories);
    expect(again).toEqual(first);
  });
});
