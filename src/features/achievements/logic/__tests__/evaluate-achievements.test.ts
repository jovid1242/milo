import { ACHIEVEMENTS } from '@/data/content/achievements';
import {
  findNewlyEarnedAchievements,
  isCriteriaMet,
  type AchievementContext,
} from '@/features/achievements/logic/evaluate-achievements';

const context = (overrides: Partial<AchievementContext> = {}): AchievementContext => ({
  completedDays: 0,
  streak: 0,
  wordsLearned: 0,
  hasPerfectQuiz: false,
  teamStreak: 0,
  ...overrides,
});

describe('isCriteriaMet', () => {
  it('checks each criteria type', () => {
    expect(isCriteriaMet({ type: 'completedDays', count: 3 }, context({ completedDays: 3 }))).toBe(
      true,
    );
    expect(isCriteriaMet({ type: 'completedDays', count: 3 }, context({ completedDays: 2 }))).toBe(
      false,
    );
    expect(isCriteriaMet({ type: 'streak', count: 7 }, context({ streak: 9 }))).toBe(true);
    expect(
      isCriteriaMet({ type: 'wordsLearned', count: 100 }, context({ wordsLearned: 100 })),
    ).toBe(true);
    expect(isCriteriaMet({ type: 'perfectQuiz' }, context({ hasPerfectQuiz: true }))).toBe(true);
    expect(isCriteriaMet({ type: 'teamStreak', count: 7 }, context({ teamStreak: 6 }))).toBe(false);
  });
});

describe('findNewlyEarnedAchievements', () => {
  it('returns only achievements that are earned and not unlocked yet', () => {
    const earned = findNewlyEarnedAchievements(
      ACHIEVEMENTS,
      context({ completedDays: 3 }),
      new Set(),
    );
    expect(earned.map((a) => a.id)).toEqual(['firstDay', 'days3']);
  });

  it('skips already unlocked achievements', () => {
    const earned = findNewlyEarnedAchievements(
      ACHIEVEMENTS,
      context({ completedDays: 3 }),
      new Set(['firstDay']),
    );
    expect(earned.map((a) => a.id)).toEqual(['days3']);
  });
});
