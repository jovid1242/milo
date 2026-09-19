import { buildAllDailyChallenges } from '@/data/content/schedule';
import type { QuestCompletion } from '@/schemas';

import { buildDayCompletion, findCompletedDays } from '../day-completion';

const AT = '2026-09-18T10:00:00.000Z';
const PLANS = buildAllDailyChallenges();

function completionsFor(day: number, { perfect = false, skip = 0 } = {}): QuestCompletion[] {
  const plan = PLANS.find((item) => item.day === day);
  if (!plan) throw new Error(`no plan for day ${day}`);
  return plan.quests.slice(0, plan.quests.length - skip).map((quest) => ({
    questId: quest.id,
    day,
    questType: quest.type,
    score: perfect ? 1 : 0.8,
    correctCount: perfect ? 5 : 4,
    totalCount: 5,
    xpEarned: quest.xpReward + (perfect ? 10 : 0),
    source: 'user',
    completedAt: AT,
  }));
}

const planFor = (day: number) => PLANS.find((plan) => plan.day === day)!;

describe('buildDayCompletion', () => {
  it('is nothing while a quest of the day is open', () => {
    const completions = completionsFor(12, { skip: 1 });
    expect(
      buildDayCompletion({
        plan: planFor(12),
        completions,
        completedDays: findCompletedDays(PLANS, completions),
        completedAt: AT,
      }),
    ).toBeNull();
  });

  it('sums the day’s XP and steps the streak by one', () => {
    const completions = [...completionsFor(10), ...completionsFor(11), ...completionsFor(12)];
    const record = buildDayCompletion({
      plan: planFor(12),
      completions,
      completedDays: findCompletedDays(PLANS, completions),
      completedAt: AT,
    });
    expect(record).toEqual({
      day: 12,
      completedAt: AT,
      questCount: 4,
      xpEarned: 65,
      streakBefore: 2,
      streakAfter: 3,
      isPerfect: false,
      celebratedAt: null,
    });
  });

  it('marks a perfect day, bonuses included in its XP', () => {
    const completions = completionsFor(12, { perfect: true });
    const record = buildDayCompletion({
      plan: planFor(12),
      completions,
      completedDays: findCompletedDays(PLANS, completions),
      completedAt: AT,
    });
    expect(record).toMatchObject({ isPerfect: true, xpEarned: 105, streakBefore: 0 });
  });
});
