import type { Team, TeamMember } from '@/schemas';

import { generateInviteCode, normalizeInviteCode } from '../invite-code';
import {
  buildTeamView,
  fromTeamMember,
  memberTodayStatus,
  teamDays,
  teamStreakOf,
  type MemberProgress,
} from '../team';
import { activityText, memberTodayLine, teamStreakCopy, todaySummary } from '../team-copy';

const TEAM: Team = {
  id: 'team-1',
  name: 'Our team',
  inviteCode: 'MILO-7K2P',
  createdAt: '2026-09-01T10:00:00.000Z',
};

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

function member(id: string, days: number[], patch: Partial<MemberProgress> = {}): MemberProgress {
  return {
    id,
    displayName: id,
    avatarUrl: null,
    isCurrentUser: id === 'me',
    joinedDay: 1,
    completedDays: new Set(days),
    todayQuestsDone: 0,
    totalXp: 100,
    achievementsUnlocked: 2,
    lastActivityAt: null,
    ...patch,
  };
}

const view = (me: MemberProgress, others: MemberProgress[], currentDay = 20) =>
  buildTeamView({ team: TEAM, me, others, currentDay, questCount: 4 });

describe('team day', () => {
  it('is not complete at 2 of 3', () => {
    const team = view(member('me', range(1, 20)), [
      member('alex', range(1, 20)),
      member('mia', range(1, 19), { todayQuestsDone: 3 }),
    ]);
    expect(team.finishedToday).toBe(2);
    expect(team.isTeamDayComplete).toBe(false);
    expect(todaySummary(team)).toEqual({ title: '2 of 3 finished today', line: 'One more to go.' });
  });

  it('is complete at 3 of 3', () => {
    const team = view(member('me', range(1, 20)), [
      member('alex', range(1, 20)),
      member('mia', range(1, 20)),
    ]);
    expect(team.isTeamDayComplete).toBe(true);
    expect(todaySummary(team).title).toBe('Team day complete');
  });
});

describe('team streak', () => {
  it('grows only on days everyone finished', () => {
    const members = [
      member('me', range(1, 19)),
      member('alex', range(1, 19)),
      member('mia', range(1, 19)),
    ];
    expect(teamStreakOf(members, 20)).toEqual({ current: 19, longest: 19 });
    // Today everyone but one has finished: still yesterday's streak.
    const partly = [
      member('me', range(1, 20)),
      member('alex', range(1, 20)),
      member('mia', range(1, 19)),
    ];
    expect(teamStreakOf(partly, 20)?.current).toBe(19);
  });

  it('breaks when one member misses a day — for the whole team', () => {
    const members = [
      member('me', range(1, 19)),
      member('alex', range(1, 19)),
      member('mia', [...range(1, 12), ...range(14, 19)]), // missed Day 13
    ];
    expect(teamStreakOf(members, 20)).toEqual({ current: 6, longest: 12 });
    expect(teamDays(members, 20).has(13)).toBe(false);
  });

  it('starts when the team has two members — days alone are not team days', () => {
    const members = [
      member('me', range(1, 19)),
      // Mia shares her whole history, but joined on Day 15.
      member('mia', range(1, 19), { joinedDay: 15 }),
    ];
    expect(teamStreakOf(members, 20)).toEqual({ current: 5, longest: 5 });
    expect(teamDays(members, 20).has(14)).toBe(false);
  });

  it('only asks new members for the days since they joined', () => {
    const members = [
      member('me', range(1, 19)),
      member('alex', range(1, 19)),
      member('mia', range(15, 19), { joinedDay: 15 }),
    ];
    expect(teamStreakOf(members, 20)?.current).toBe(19);
  });

  it('does not exist without someone to share it with', () => {
    expect(teamStreakOf([member('me', range(1, 19))], 20)).toBeNull();
  });

  it('is told kindly', () => {
    const none = view(member('me', range(1, 19)), [member('alex', range(1, 18))]);
    expect(none.teamStreak).toBe(0);
    expect(teamStreakCopy(none).title).toBe('Start your team streak');
    const alive = view(member('me', range(1, 19)), [member('alex', range(1, 19))]);
    expect(teamStreakCopy(alive)).toEqual({
      title: '19 days',
      line: 'Everyone finished yesterday. Keep the streak alive.',
    });
  });
});

describe('members', () => {
  it('derive their status for today', () => {
    const at = (patch: Partial<MemberProgress>, days: number[] = []) =>
      memberTodayStatus(member('x', days, patch), 20, 4);
    expect(at({}, [20])).toBe('done');
    expect(at({ todayQuestsDone: 3 })).toBe('almostThere');
    expect(at({ todayQuestsDone: 1 })).toBe('inProgress');
    expect(at({ todayQuestsDone: 0 })).toBe('notStarted');
    expect(at({ todayQuestsDone: null })).toBe('unknown');
  });

  it('keep missing stats missing — never 0', () => {
    const shared: TeamMember = {
      id: 'mia',
      displayName: 'Mia',
      avatarUrl: null,
      joinedDay: 1,
      completedDays: range(1, 19),
      today: null,
      totalXp: null,
      achievementsUnlocked: null,
      lastActivityAt: null,
    };
    const mia = fromTeamMember(shared, 20);
    expect(mia).toMatchObject({ todayQuestsDone: null, totalXp: null, achievementsUnlocked: null });
    const team = view(member('me', range(1, 19)), [mia]);
    const shown = team.members.find((item) => item.id === 'mia');
    expect(shown?.status).toBe('unknown');
    expect(shown && memberTodayLine(shown, team)).toBe('Day 20');
    // Their streak comes from the day history the team challenge needs anyway.
    expect(shown?.streak).toBe(19);
  });

  it('treats progress shared for another day as nothing done today', () => {
    const stale: TeamMember = {
      id: 'alex',
      displayName: 'Alex',
      avatarUrl: null,
      joinedDay: 1,
      completedDays: [],
      today: { day: 19, questsDone: 3 },
      totalXp: 10,
      achievementsUnlocked: 1,
      lastActivityAt: null,
    };
    expect(fromTeamMember(stale, 20).todayQuestsDone).toBe(0);
  });

  it('put the current user first, then everyone in joining order — not by XP', () => {
    const team = view(member('me', [], { totalXp: 5 }), [
      member('mia', [], { joinedDay: 3, totalXp: 900 }),
      member('alex', [], { joinedDay: 1, totalXp: 50 }),
    ]);
    expect(team.members.map((item) => item.id)).toEqual(['me', 'alex', 'mia']);
  });
});

describe('invite codes', () => {
  it('are readable and normalised', () => {
    const code = generateInviteCode(() => 0.5);
    expect(code).toMatch(/^MILO-[A-HJ-NP-Z2-9]{4}$/);
    expect(normalizeInviteCode(' milo 7k2p ')).toBe('MILO-7K2P');
    expect(normalizeInviteCode('7K2P')).toBe('MILO-7K2P');
    expect(normalizeInviteCode('MILO-0O1I')).toBeNull(); // ambiguous characters
    expect(normalizeInviteCode('hello')).toBeNull();
  });
});

describe('activity words', () => {
  it('are built from structured events', () => {
    const title = () => 'Perfect Quiz';
    const base = { id: 'a', memberId: 'alex', createdAt: '2026-09-01T10:00:00.000Z' };
    expect(
      activityText({ ...base, type: 'dayCompleted', metadata: { day: 89 } }, 'Alex', title),
    ).toBe('Alex completed Day 89');
    expect(
      activityText({ ...base, type: 'streakMilestone', metadata: { days: 7 } }, 'Mia', title),
    ).toBe('Mia reached a 7-day streak');
    expect(
      activityText(
        { ...base, type: 'achievementUnlocked', metadata: { achievementId: 'perfectQuiz' } },
        'You',
        title,
      ),
    ).toBe('You unlocked Perfect Quiz');
  });
});
