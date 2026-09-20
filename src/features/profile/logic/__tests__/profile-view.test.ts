import { ACHIEVEMENTS } from '@/data/content/achievements';
import { CHAPTERS } from '@/data/content/chapters';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import type { TeamView } from '@/features/friends/logic/team';
import { loadProgressState } from '@/features/progress/use-cases';
import type { AchievementStatus, ProgressState, User } from '@/schemas';

import { buildProfileView } from '../profile-view';

const USER: User = {
  id: 'local-user',
  displayName: 'Alex',
  challengeStartDate: '2026-06-22',
  goal: 'habit',
  onboardedAt: '2026-06-22T08:00:00.000Z',
  createdAt: '2026-06-22T08:00:00.000Z',
};

const progress = (patch: Partial<ProgressState> = {}): ProgressState => ({
  currentDay: 89,
  chapterId: 'growth',
  totalXp: 7370,
  level: { level: 12, xpIntoLevel: 100, xpForNextLevel: 800, progress: 0.125 },
  streak: 89,
  completedDays: Array.from({ length: 89 }, (_, index) => index + 1),
  wordsLearned: 126,
  todayCompletedQuestIds: [],
  isTodayComplete: true,
  hasPerfectQuiz: true,
  unlockedAchievementIds: [],
  challengeCompletion: null,
  ...patch,
});

const status = (index: number, unlockedAt: string | null): AchievementStatus => {
  const achievement = ACHIEVEMENTS[index];
  if (!achievement) throw new Error(`no achievement ${index}`);
  return {
    achievement,
    state: unlockedAt ? 'unlocked' : 'locked',
    unlockedAt,
    progress: null,
  };
};

const build = (patch: Partial<Parameters<typeof buildProfileView>[0]> = {}) =>
  buildProfileView({
    user: USER,
    progress: progress(),
    chapters: CHAPTERS,
    achievements: [],
    team: null,
    totalDays: 90,
    ...patch,
  });

describe('buildProfileView', () => {
  it('projects the header and the four stats from progress', () => {
    const view = build();
    expect(view).toMatchObject({
      displayName: 'Alex',
      avatarUrl: null,
      currentDay: 89,
      chapterLine: 'Chapter 04 · Growth',
      stats: { streak: 89, totalXp: 7370, completedDays: 89, wordsLearned: 126 },
    });
  });

  it('shows the journey as completed days of 90, with days to the summit', () => {
    expect(build().journey).toEqual({
      completedDays: 89,
      totalDays: 90,
      daysToSummit: 1,
      progress: 89 / 90,
    });
    const done = build({
      progress: progress({
        currentDay: 90,
        completedDays: Array.from({ length: 90 }, (_, index) => index + 1),
      }),
    });
    expect(done.journey).toMatchObject({ completedDays: 90, daysToSummit: 0, progress: 1 });
  });

  it('previews the latest unlocked badges from the achievement state — never locked ones', () => {
    const view = build({
      achievements: [
        status(0, '2026-07-01T10:00:00.000Z'),
        status(1, '2026-07-05T10:00:00.000Z'),
        status(2, null),
        status(3, '2026-08-01T10:00:00.000Z'),
        status(4, '2026-08-20T10:00:00.000Z'),
        status(5, '2026-09-01T10:00:00.000Z'),
      ],
    });
    expect(view.achievements.unlocked).toBe(5);
    expect(view.achievements.total).toBe(6);
    expect(view.achievements.recent.map((item) => item.achievement.id)).toEqual([
      'days50',
      'days30',
      'days14',
      'days3',
    ]);
  });

  it('sums up the team — or nothing without one', () => {
    expect(build().team).toBeNull();
    const team = {
      members: [{}, {}, {}],
      teamStreak: 12,
      finishedToday: 2,
    } as unknown as TeamView;
    expect(build({ team }).team).toEqual({ members: 3, teamStreak: 12, finishedToday: 2 });
  });
});

describe('words learned', () => {
  it('counts each word once, whichever lessons taught it', async () => {
    const repositories = createMemoryRepositories(getStartDateForDay(5, new Date()));
    const at = '2026-09-18T10:00:00.000Z';
    const words = (quest: string) =>
      ['goal', 'habit', 'journey'].map((wordId) => ({ wordId, questId: quest, learnedAt: at }));
    await repositories.progress.recordLearnedWords(words('lesson-a'));
    await repositories.progress.recordLearnedWords(words('lesson-b'));
    expect((await loadProgressState(repositories)).wordsLearned).toBe(3);
  });
});
