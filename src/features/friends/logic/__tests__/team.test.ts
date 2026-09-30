import { LOCAL_COURSE } from '@/content/course';
import { CourseReader, validatedCourse } from '@/data/repositories/course/course-reader';
import type { TeamMemberSummary, TeamSnapshot } from '@/schemas';

import {
  inviteCodeFromBytes,
  inviteLink,
  normalizeInviteCode,
  parseInviteInput,
} from '../invite-code';
import { buildTeamView, memberTodayStatus, teamStreakFacts, type MyProgress } from '../team';
import {
  inviteExpiry,
  inviteShareMessage,
  memberName,
  memberTodayLine,
  previewCopy,
  teamStreakCopy,
  todaySummary,
} from '../team-copy';

const plans = new CourseReader(validatedCourse(LOCAL_COURSE)).days();
const NOW = new Date('2026-09-12T12:00:00.000Z');
const ME = '00000000-0000-4000-8000-000000000001';
const BEA = '00000000-0000-4000-8000-000000000002';
const CY = '00000000-0000-4000-8000-000000000003';

function summary(userId: string, patch: Partial<TeamMemberSummary> = {}): TeamMemberSummary {
  return {
    userId,
    displayName: userId === ME ? 'Ada' : userId === BEA ? 'Bea' : 'Cy',
    avatarUrl: null,
    role: 'member',
    joinedAt: '2026-09-01T09:00:00.000Z',
    currentDay: 12,
    todayCompleted: false,
    todayQuestsDone: 0,
    streak: 11,
    totalXp: 800,
    daysCompleted: 11,
    achievementsUnlocked: 4,
    lastActivityAt: '2026-09-12T08:00:00.000Z',
    ...patch,
  };
}

function snapshot(patch: Partial<TeamSnapshot> = {}): TeamSnapshot {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    name: "Ada's team",
    capacity: 3,
    createdAt: '2026-09-01T09:00:00.000Z',
    members: [summary(ME, { role: 'owner' }), summary(BEA), summary(CY)],
    streak: { current: 4, longest: 9, todayComplete: false },
    invite: null,
    ...patch,
  };
}

const me = (patch: Partial<MyProgress> = {}): MyProgress => ({
  currentDay: 12,
  completedDays: new Set(Array.from({ length: 11 }, (_, index) => index + 1)),
  todayQuestsDone: 1,
  streak: 11,
  totalXp: 820,
  achievementsUnlocked: 5,
  lastActivityAt: '2026-09-12T11:00:00.000Z',
  ...patch,
});

const view = (team: TeamSnapshot, progress: MyProgress | null = me(), asOf = NOW.toISOString()) =>
  buildTeamView({ team, asOf, selfId: ME, me: progress, plans, now: NOW });

describe('the team view', () => {
  it('puts the user first, then everyone in the order they joined — never by XP', () => {
    const team = snapshot({
      members: [summary(BEA, { role: 'owner', totalXp: 9000 }), summary(ME), summary(CY)],
    });
    expect(view(team).members.map((member) => member.displayName)).toEqual(['Ada', 'Bea', 'Cy']);
    expect(view(team).members[1]?.isOwner).toBe(true);
  });

  it('shows the user’s own card from their phone — ahead of the server', () => {
    const [mine] = view(snapshot()).members;
    expect(mine).toMatchObject({
      isCurrentUser: true,
      todayQuestsDone: 1,
      totalXp: 820,
      achievementsUnlocked: 5,
      status: 'inProgress',
    });
  });

  it('shows each teammate on their own day, with the server’s numbers', () => {
    const team = snapshot({
      members: [summary(ME), summary(BEA, { currentDay: 9, todayQuestsDone: 3, totalXp: 640 })],
    });
    const bea = view(team).members[1];
    expect(bea).toMatchObject({ currentDay: 9, totalXp: 640, streak: 11 });
    expect(memberTodayLine(bea!)).toMatch(/^Day 9 · 3 of \d quests$/);
  });

  it('counts who finished today, and completes the team day with the last of them', () => {
    const done = { todayCompleted: true, todayQuestsDone: 4 };
    const team = snapshot({ members: [summary(ME), summary(BEA, done), summary(CY, done)] });
    expect(view(team)).toMatchObject({ finishedToday: 2, isTeamDayComplete: false, teamStreak: 4 });
    expect(todaySummary(view(team))).toEqual({
      title: '2 of 3 finished today',
      line: 'One more to go.',
    });

    // The user's last quest, before the server has heard of it: the team day is theirs to see.
    const finished = me({ completedDays: new Set(Array.from({ length: 12 }, (_, i) => i + 1)) });
    const complete = view(team, finished);
    expect(complete).toMatchObject({ finishedToday: 3, isTeamDayComplete: true, teamStreak: 5 });
    expect(todaySummary(complete).title).toBe('Team day complete');
    expect(teamStreakCopy(complete)).toEqual({ title: '5 days', line: 'Everyone finished today.' });
  });

  it('never counts a team day twice once the server has it', () => {
    const done = { todayCompleted: true, todayQuestsDone: 4 };
    const team = snapshot({
      members: [summary(ME, done), summary(BEA, done), summary(CY, done)],
      streak: { current: 5, longest: 9, todayComplete: true },
    });
    const finished = me({ completedDays: new Set(Array.from({ length: 12 }, (_, i) => i + 1)) });
    expect(view(team, finished).teamStreak).toBe(5);
  });

  it('shows yesterday’s answer as yesterday’s: nobody has done today yet', () => {
    const done = { todayCompleted: true, todayQuestsDone: 4 };
    const team = snapshot({ members: [summary(ME), summary(BEA, done)] });
    const stale = view(team, me(), '2026-09-11T12:00:00.000Z');
    expect(stale.members[1]).toMatchObject({
      currentDay: 13,
      todayQuestsDone: 0,
      status: 'notStarted',
    });
    expect(stale.asOf).toBe('2026-09-11T12:00:00.000Z');
  });

  it('knows when the team is full, and hides an invite past its end', () => {
    expect(view(snapshot()).isFull).toBe(true);
    const invite = {
      id: '00000000-0000-4000-8000-0000000000bb',
      code: '7K2PX-9QDMA',
      createdBy: ME,
      createdAt: '2026-09-01T09:00:00.000Z',
      expiresAt: '2026-09-08T09:00:00.000Z',
    };
    const pair = snapshot({ members: [summary(ME), summary(BEA)], invite });
    expect(view(pair)).toMatchObject({ isFull: false, invite: null });
    expect(
      view({ ...pair, invite: { ...invite, expiresAt: '2026-09-15T09:00:00.000Z' } }).invite,
    ).not.toBeNull();
  });

  it('gives the badges the team streak only with someone to share it', () => {
    expect(teamStreakFacts(view(snapshot()))).toEqual({ current: 4, longest: 9 });
    expect(teamStreakFacts(view(snapshot({ members: [summary(ME)] })))).toBeNull();
    expect(teamStreakFacts(null)).toBeNull();
  });
});

describe('members', () => {
  it('derive their status for today', () => {
    const status = (todayQuestsDone: number, todayCompleted = false) =>
      memberTodayStatus({ todayCompleted, todayQuestsDone, questCount: 4 });
    expect(status(4, true)).toBe('done');
    expect(status(3)).toBe('almostThere');
    expect(status(1)).toBe('inProgress');
    expect(status(0)).toBe('notStarted');
  });

  it('are called by name — the user is "You"', () => {
    const [mine, bea] = view(snapshot()).members;
    expect(memberName(mine!)).toBe('You');
    expect(memberName(bea!)).toBe('Bea');
  });
});

describe('words for the team', () => {
  it('tell a broken streak kindly', () => {
    expect(
      teamStreakCopy(view(snapshot({ streak: { current: 0, longest: 3, todayComplete: false } }))),
    ).toEqual({
      title: 'Start your team streak',
      line: 'Finish a day together to light it.',
    });
  });

  it('share a short invitation with the link and the code', () => {
    const message = inviteShareMessage('7K2PX-9QDMA');
    expect(message).toContain('milo://invite/7K2PX-9QDMA');
    expect(message).toContain('the code 7K2PX-9QDMA');
    expect(message.split('\n')).toHaveLength(3);
  });

  it('say how long an invite has left', () => {
    expect(inviteExpiry('2026-09-19T12:00:00.000Z', NOW)).toBe('Expires in 7 days');
    expect(inviteExpiry('2026-09-13T11:00:00.000Z', NOW)).toBe('Expires in 1 day');
    expect(inviteExpiry('2026-09-12T11:00:00.000Z', NOW)).toBe('Expired');
  });

  it('preview a team — size, and what the user can do', () => {
    const preview = {
      teamName: "Ada's team",
      ownerName: 'Ada',
      memberCount: 2,
      capacity: 3,
      expiresAt: '2026-09-19T12:00:00.000Z',
    };
    expect(previewCopy({ ...preview, status: 'canJoin' })).toMatchObject({
      title: "Ada's team",
      line: expect.stringMatching(/^2\/3 members\./),
    });
    expect(previewCopy({ ...preview, memberCount: 3, status: 'full' }).line).toBe(
      'A Milo team has 3 people, and this one is complete. You can start a team of your own.',
    );
    expect(previewCopy({ ...preview, status: 'inAnotherTeam' }).line).toMatch(/leave yours first/);
  });
});

describe('invite codes and links', () => {
  it('are read however they are typed', () => {
    expect(normalizeInviteCode('7k2px 9qdma')).toBe('7K2PX-9QDMA');
    expect(normalizeInviteCode(' 7K2PX-9QDMA ')).toBe('7K2PX-9QDMA');
    expect(normalizeInviteCode('7K2PX9QDMA')).toBe('7K2PX-9QDMA');
    for (const wrong of ['', '7K2PX', 'O0I1L-ABCDE', '7K2PX-9QDMAA', 'MILO-7K2P']) {
      expect(normalizeInviteCode(wrong)).toBeNull();
    }
  });

  it('are found in a pasted link — the app’s own, or any …/invite/<code>', () => {
    for (const input of [
      'milo://invite/7K2PX-9QDMA',
      'milo:///invite/7k2px-9qdma?from=share',
      'https://milo.app/invite/7K2PX9QDMA#top',
      'Join my team on Milo — Open: milo://invite/7K2PX-9QDMA\nOr enter the code…',
      '7K2PX-9QDMA',
    ]) {
      expect(parseInviteInput(input)).toBe('7K2PX-9QDMA');
    }
    expect(parseInviteInput('milo://invite/')).toBeNull();
    expect(parseInviteInput('milo://invite/%E0%A4%A')).toBeNull();
    expect(parseInviteInput('https://example.com/7K2PX-9QDMA/other')).toBeNull();
    expect(inviteLink('7K2PX-9QDMA')).toBe('milo://invite/7K2PX-9QDMA');
  });

  it('are made from 50 random bits, in the readable alphabet', () => {
    const code = inviteCodeFromBytes(new Uint8Array([0, 0, 0, 0, 0, 0, 0]));
    expect(code).toBe('AAAAA-AAAAA');
    expect(inviteCodeFromBytes(new Uint8Array([255, 255, 255, 255, 255, 255, 255]))).toBe(
      '99999-99999',
    );
    const other = inviteCodeFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
    expect(other).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(() => inviteCodeFromBytes(new Uint8Array(6))).toThrow();
  });
});
