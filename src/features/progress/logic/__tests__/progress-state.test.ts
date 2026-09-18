import { CHAPTERS } from '@/data/content/chapters';
import { buildAllDailyChallenges, questId } from '@/data/content/schedule';
import { buildProgressState } from '@/features/progress/logic/progress-state';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import type { DailyChallenge, QuestCompletion, User } from '@/schemas';

const NOW = new Date(2026, 8, 18, 12, 0, 0);
const PLANS = buildAllDailyChallenges();

const user = (currentDay: number): User => ({
  id: 'local-user',
  displayName: 'Explorer',
  challengeStartDate: getStartDateForDay(currentDay, NOW),
  createdAt: NOW.toISOString(),
});

const completionsFor = (plans: DailyChallenge[], days: number[]): QuestCompletion[] =>
  plans
    .filter((plan) => days.includes(plan.day))
    .flatMap((plan) =>
      plan.quests.map((quest) => ({
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: 1,
        correctCount: 5,
        totalCount: 5,
        xpEarned: quest.xpReward,
        source: 'user' as const,
        completedAt: NOW.toISOString(),
      })),
    );

const build = (
  currentDay: number,
  completedDays: number[],
  extra: Partial<Parameters<typeof buildProgressState>[0]> = {},
) =>
  buildProgressState({
    user: user(currentDay),
    chapters: CHAPTERS,
    dailyChallenges: PLANS,
    completions: completionsFor(PLANS, completedDays),
    totalXp: 0,
    unlocks: [],
    now: NOW,
    ...extra,
  });

describe('buildProgressState', () => {
  it('derives the current day and its chapter', () => {
    const state = build(12, []);
    expect(state.currentDay).toBe(12);
    expect(state.chapterId).toBe('momentum');
  });

  it('marks a day complete only when every quest of that day is done', () => {
    const partial = completionsFor(PLANS, [1]).slice(0, 2);
    const state = build(2, [], { completions: partial });
    expect(state.completedDays).toEqual([]);

    const full = build(2, [1]);
    expect(full.completedDays).toEqual([1]);
  });

  it('computes streak, words learned and today progress', () => {
    const state = build(4, [1, 2, 3]);
    expect(state.streak).toBe(3);
    // 6 words per vocabulary quest on days 1–3
    expect(state.wordsLearned).toBe(18);
    expect(state.isTodayComplete).toBe(false);
    expect(state.todayCompletedQuestIds).toEqual([]);
  });

  it('reports today as complete and keeps perfect quiz state', () => {
    const state = build(3, [1, 2, 3]);
    expect(state.isTodayComplete).toBe(true);
    expect(state.todayCompletedQuestIds).toContain(questId(3, 'vocabulary'));
    expect(state.hasPerfectQuiz).toBe(true);
  });
});
