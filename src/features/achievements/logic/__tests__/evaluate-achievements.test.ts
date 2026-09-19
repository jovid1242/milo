import { ACHIEVEMENTS } from '@/data/content/achievements';
import { buildAllDailyChallenges } from '@/data/content/schedule';
import { AchievementSchema, AchievementStatusSchema, type QuestCompletion } from '@/schemas';

import {
  buildAchievementFacts,
  checkRule,
  evaluateAchievements,
  findNewlyEarned,
  longestRun,
  planCelebration,
  type AchievementFacts,
} from '../evaluate-achievements';

const PLANS = buildAllDailyChallenges();
const AT = '2026-09-18T10:00:00.000Z';

const facts = (patch: Partial<AchievementFacts> = {}): AchievementFacts => ({
  completedDays: 0,
  currentStreak: 0,
  longestStreak: 0,
  uniqueWords: 0,
  hasPerfectQuest: false,
  currentPerfectRun: 0,
  longestPerfectRun: 0,
  teamStreak: null,
  ...patch,
});

/** Completions for whole days; `perfect` days have every answer right. */
function daysDone(days: readonly number[], perfect: readonly number[] = []): QuestCompletion[] {
  return PLANS.filter((plan) => days.includes(plan.day)).flatMap((plan) =>
    plan.quests.map((quest) => {
      const right = perfect.includes(plan.day);
      return {
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: right ? 1 : 5 / 6,
        correctCount: right ? 6 : 5,
        totalCount: 6,
        xpEarned: quest.xpReward,
        source: 'user' as const,
        completedAt: AT,
      };
    }),
  );
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

const byId = (id: string) => {
  const found = ACHIEVEMENTS.find((achievement) => achievement.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('definitions', () => {
  it('has the 12 badges, each valid and tied to its badge asset', () => {
    expect(ACHIEVEMENTS).toHaveLength(12);
    for (const achievement of ACHIEVEMENTS) {
      AchievementSchema.parse(achievement);
      expect(achievement.badge).toBe(achievement.id);
    }
  });
});

describe('facts', () => {
  it('tells the running streak from the longest one', () => {
    const built = buildAchievementFacts({
      plans: PLANS,
      completions: daysDone([...range(1, 10), ...range(14, 16)]),
      dayCompletions: [],
      uniqueWords: 0,
      currentDay: 17,
    });
    expect(built).toMatchObject({ completedDays: 13, currentStreak: 3, longestStreak: 10 });
    expect(longestRun(new Set([2, 3, 4, 8, 9]))).toBe(3);
  });

  it('counts perfect days only in an unbroken row', () => {
    const built = buildAchievementFacts({
      plans: PLANS,
      completions: daysDone(range(1, 9), [1, 2, 3, 5, 6, 7, 8]),
      dayCompletions: [],
      uniqueWords: 0,
      currentDay: 10,
    });
    expect(built.longestPerfectRun).toBe(4); // 5–8
    expect(built.currentPerfectRun).toBe(0); // Day 9 was not perfect
  });

  it('prefers the day record for a perfect day', () => {
    const built = buildAchievementFacts({
      plans: PLANS,
      completions: daysDone([1], [1]),
      dayCompletions: [
        {
          day: 1,
          completedAt: AT,
          questCount: 4,
          xpEarned: 65,
          streakBefore: 0,
          streakAfter: 1,
          isPerfect: false,
          celebratedAt: AT,
        },
      ],
      uniqueWords: 0,
      currentDay: 1,
    });
    expect(built.longestPerfectRun).toBe(0);
  });
});

describe('rules', () => {
  it('unlocks First Day with the first completed day', () => {
    expect(checkRule(byId('firstDay').rule, facts()).met).toBe(false);
    expect(checkRule(byId('firstDay').rule, facts({ completedDays: 1 }))).toEqual({
      available: true,
      met: true,
      progress: null, // a yes/no badge has no "0 / 1"
    });
  });

  it('unlocks the streak badges on days in a row, not on days in total', () => {
    const days3 = byId('days3').rule;
    expect(checkRule(days3, facts({ completedDays: 30, longestStreak: 2 })).met).toBe(false);
    expect(checkRule(days3, facts({ longestStreak: 3 })).met).toBe(true);
    expect(checkRule(byId('days7').rule, facts({ longestStreak: 6 })).met).toBe(false);
    expect(checkRule(byId('days7').rule, facts({ longestStreak: 7 })).met).toBe(true);
  });

  it('shows real progress for the 30-day streak', () => {
    expect(checkRule(byId('days30').rule, facts({ currentStreak: 18, longestStreak: 18 }))).toEqual(
      {
        available: true,
        met: false,
        progress: { current: 18, target: 30 },
      },
    );
  });

  it('counts unique words for 100 and 500', () => {
    expect(checkRule(byId('words100').rule, facts({ uniqueWords: 99 }))).toMatchObject({
      met: false,
      progress: { current: 99, target: 100 },
    });
    expect(checkRule(byId('words100').rule, facts({ uniqueWords: 100 })).met).toBe(true);
    expect(checkRule(byId('words500').rule, facts({ uniqueWords: 499 })).met).toBe(false);
    expect(checkRule(byId('words500').rule, facts({ uniqueWords: 500 })).met).toBe(true);
  });

  it('needs a completely right scored quest for Perfect Quiz', () => {
    const perfect = (completions: QuestCompletion[]) =>
      buildAchievementFacts({
        plans: PLANS,
        completions,
        dayCompletions: [],
        uniqueWords: 0,
        currentDay: 1,
      }).hasPerfectQuest;
    const [quest] = daysDone([1]);
    if (!quest) throw new Error('no quest');
    expect(perfect([{ ...quest, correctCount: 5, totalCount: 6 }])).toBe(false); // 5/6
    expect(perfect([{ ...quest, correctCount: 6, totalCount: 6 }])).toBe(true);
    expect(perfect([{ ...quest, correctCount: 0, totalCount: 0 }])).toBe(false); // nothing scored
  });

  it('needs seven perfect days in a row for Perfect Week', () => {
    const week = (completions: QuestCompletion[], currentDay: number) =>
      checkRule(
        byId('perfectWeek').rule,
        buildAchievementFacts({
          plans: PLANS,
          completions,
          dayCompletions: [],
          uniqueWords: 0,
          currentDay,
        }),
      ).met;
    expect(week(daysDone(range(1, 7), range(1, 7)), 7)).toBe(true);
    expect(week(daysDone(range(1, 6), range(1, 6)), 6)).toBe(false); // six
    // Seven perfect days, but not in a row.
    expect(week(daysDone(range(1, 8), [1, 2, 3, 5, 6, 7, 8]), 8)).toBe(false);
  });

  it('keeps Team Streak unavailable while Friends do not exist', () => {
    expect(checkRule(byId('teamStreak').rule, facts({ longestStreak: 90 }))).toEqual({
      available: false,
      met: false,
      progress: null,
    });
  });
});

describe('evaluateAchievements', () => {
  it('derives every badge: locked with progress, unlocked, not available', () => {
    const statuses = evaluateAchievements(
      ACHIEVEMENTS,
      facts({ completedDays: 20, currentStreak: 18, longestStreak: 18, uniqueWords: 73 }),
      [{ achievementId: 'firstDay', unlockedAt: AT, celebratedAt: AT }],
    );
    for (const status of statuses) AchievementStatusSchema.parse(status);
    const of = (id: string) => statuses.find((status) => status.achievement.id === id);
    expect(of('firstDay')).toMatchObject({ state: 'unlocked', unlockedAt: AT, progress: null });
    expect(of('days30')).toMatchObject({ state: 'locked', progress: { current: 18, target: 30 } });
    expect(of('words100')).toMatchObject({
      state: 'locked',
      progress: { current: 73, target: 100 },
    });
    expect(of('perfectQuiz')).toMatchObject({ state: 'locked', progress: null });
    expect(of('teamStreak')).toMatchObject({ state: 'notAvailable', progress: null });
  });

  it('never locks an unlocked badge again, whatever happens to the streak', () => {
    const [status] = evaluateAchievements(
      [byId('days7')],
      facts({ currentStreak: 0, longestStreak: 0 }),
      [{ achievementId: 'days7', unlockedAt: AT, celebratedAt: AT }],
    );
    expect(status?.state).toBe('unlocked');
  });

  it('finds only badges that are earned and not unlocked yet', () => {
    const earned = findNewlyEarned(
      ACHIEVEMENTS,
      facts({ completedDays: 3, longestStreak: 3 }),
      new Set(['firstDay'] as const),
    );
    expect(earned.map((achievement) => achievement.id)).toEqual(['days3']);
  });
});

describe('planCelebration', () => {
  it('leads with the biggest badge and sums up the rest — one card, not a popup each', () => {
    const plan = planCelebration(
      ['firstDay', 'days3', 'days7', 'perfectQuiz', 'perfectWeek'].map(byId),
    );
    expect(plan?.lead.id).toBe('perfectWeek');
    expect(plan?.others.map((achievement) => achievement.id)).toEqual([
      'days7',
      'perfectQuiz',
      'days3',
      'firstDay',
    ]);
    expect(planCelebration([])).toBeNull();
  });
});
