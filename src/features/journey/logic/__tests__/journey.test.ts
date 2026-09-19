import { CHAPTERS } from '@/data/content/chapters';
import { buildAllDailyChallenges } from '@/data/content/schedule';
import { findChapterForDay } from '@/features/challenge/logic/calendar';
import { JourneySchema, type DayCompletion, type QuestCompletion } from '@/schemas';

import { buildJourney, canStartDay, daysUntil } from '../journey';

const PLANS = buildAllDailyChallenges();
const AT = '2026-09-18T10:00:00.000Z';

function completionsFor(days: readonly number[], { perfect = false } = {}): QuestCompletion[] {
  return PLANS.filter((plan) => days.includes(plan.day)).flatMap((plan) =>
    plan.quests.map((quest) => ({
      questId: quest.id,
      day: plan.day,
      questType: quest.type,
      score: perfect ? 1 : 0.8,
      correctCount: perfect ? 5 : 4,
      totalCount: 5,
      xpEarned: quest.xpReward,
      source: 'user' as const,
      completedAt: AT,
    })),
  );
}

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);

function journeyAt(
  currentDay: number,
  completedDays: readonly number[],
  extra: { completions?: QuestCompletion[]; dayCompletions?: DayCompletion[] } = {},
) {
  const journey = buildJourney({
    plans: PLANS,
    chapters: CHAPTERS,
    completions: [...completionsFor(completedDays), ...(extra.completions ?? [])],
    dayCompletions: extra.dayCompletions ?? [],
    currentDay,
  });
  // The derived view always satisfies its own schema.
  JourneySchema.parse(journey);
  return journey;
}

const dayOf = (journey: ReturnType<typeof journeyAt>, day: number) => {
  const found = journey.days[day - 1];
  if (!found) throw new Error(`no day ${day}`);
  return found;
};

describe('chapters along the route', () => {
  it.each([
    [1, 'beginning'],
    [10, 'beginning'],
    [11, 'momentum'],
    [30, 'momentum'],
    [31, 'habit'],
    [60, 'habit'],
    [61, 'growth'],
    [89, 'growth'],
    [90, 'summit'],
  ])('Day %i belongs to %s', (day, chapterId) => {
    expect(findChapterForDay(CHAPTERS, day).id).toBe(chapterId);
    expect(dayOf(journeyAt(1, []), day).chapterId).toBe(chapterId);
  });
});

describe('buildJourney', () => {
  it('knows where the user is: today, the days behind and the days ahead', () => {
    const journey = journeyAt(42, range(1, 41));
    expect(journey.days.filter((day) => day.isToday).map((day) => day.day)).toEqual([42]);
    expect(dayOf(journey, 42).state).toBe('available');
    expect(dayOf(journey, 41).state).toBe('completed');
    expect(dayOf(journey, 43).state).toBe('locked');
    expect(journey.completedDays).toBe(41);
    expect(journey.isComplete).toBe(false);
  });

  it('marks days that passed without their quests as missed', () => {
    const journey = journeyAt(12, [...range(1, 9), 11]);
    expect(dayOf(journey, 10).state).toBe('missed');
    expect(dayOf(journey, 11).state).toBe('completed');
    // A day with only some quests done is not complete.
    const partial = journeyAt(5, range(1, 3), {
      completions: completionsFor([4]).slice(0, 2),
    });
    expect(dayOf(partial, 4)).toMatchObject({ state: 'missed', completedQuestCount: 2 });
  });

  it('marks the special stops: weekly exams, chapter ends and the summit', () => {
    const journey = journeyAt(1, []);
    const kinds = (kind: string) =>
      journey.days.filter((day) => day.kind === kind).map((day) => day.day);
    expect(kinds('weeklyExam')).toEqual([7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84]);
    expect(kinds('chapterEnd')).toEqual([10, 30, 60, 89]);
    expect(kinds('summit')).toEqual([90]);
    // The summit is one quest: the Final Battle.
    expect(dayOf(journey, 90).questCount).toBe(1);
  });

  it('keeps Day 90 locked on Day 89, and opens it on Day 90', () => {
    const day89Done = journeyAt(89, range(1, 89));
    expect(dayOf(day89Done, 89)).toMatchObject({ state: 'completed', isToday: true });
    expect(dayOf(day89Done, 90).state).toBe('locked');
    expect(daysUntil(dayOf(day89Done, 90), 89)).toBe(1);

    const day90 = journeyAt(90, range(1, 89));
    expect(dayOf(day90, 90)).toMatchObject({ state: 'available', isToday: true });
    expect(canStartDay(dayOf(day90, 90))).toBe(true);
  });

  it('never lets a future day start — only today can', () => {
    const journey = journeyAt(30, range(1, 29));
    expect(canStartDay(dayOf(journey, 31))).toBe(false);
    expect(canStartDay(dayOf(journey, 90))).toBe(false);
    expect(canStartDay(dayOf(journey, 29))).toBe(false); // already done
    expect(canStartDay(dayOf(journey, 30))).toBe(true);
  });

  it('shows 90 of 90 as a completed journey', () => {
    const journey = journeyAt(90, range(1, 90));
    expect(journey).toMatchObject({ completedDays: 90, totalDays: 90, isComplete: true });
    expect(journey.chapters.every((chapter) => chapter.state === 'completed')).toBe(true);
    expect(dayOf(journey, 90).state).toBe('completed');
  });

  it('describes each chapter from its days', () => {
    const journey = journeyAt(35, [...range(1, 12), ...range(14, 34)]);
    const states = Object.fromEntries(
      journey.chapters.map((chapter) => [chapter.chapter.id, chapter.state]),
    );
    expect(states).toEqual({
      beginning: 'completed',
      momentum: 'passed', // Day 13 was missed
      habit: 'current',
      growth: 'upcoming',
      summit: 'upcoming',
    });
    expect(journey.chapters[1]).toMatchObject({ completedDays: 19, totalDays: 20 });
  });

  it('shows stored facts only, preferring the day record', () => {
    const journey = journeyAt(20, range(1, 19), {
      dayCompletions: [
        {
          day: 12,
          completedAt: '2026-08-01T18:00:00.000Z',
          questCount: 4,
          xpEarned: 75,
          streakBefore: 11,
          streakAfter: 12,
          isPerfect: true,
          celebratedAt: null,
        },
      ],
    });
    expect(dayOf(journey, 12)).toMatchObject({
      xpEarned: 75,
      isPerfect: true,
      completedAt: '2026-08-01T18:00:00.000Z',
    });
    // Without a record: derived from the quest completions themselves.
    expect(dayOf(journey, 11)).toMatchObject({
      xpEarned: 65,
      isPerfect: false,
      completedAt: AT,
      completedQuestCount: 4,
    });
    // Nothing done yet: no invented numbers.
    expect(dayOf(journey, 25)).toMatchObject({
      xpEarned: null,
      isPerfect: null,
      completedAt: null,
      completedQuestCount: 0,
    });
  });
});
