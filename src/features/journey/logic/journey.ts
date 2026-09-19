import { findChapterForDay } from '@/features/challenge/logic/calendar';
import { examStatus } from '@/features/exams/logic/exam';
import { findCompletedDays } from '@/features/progress/logic/day-completion';
import type {
  Chapter,
  DailyChallenge,
  DayCompletion,
  DayNumber,
  Journey,
  JourneyChapter,
  JourneyDay,
  JourneyDayKind,
  JourneyDayState,
  JourneyExam,
  QuestCompletion,
  ExamAttempt,
} from '@/schemas';

export type JourneyInput = {
  plans: readonly DailyChallenge[];
  chapters: readonly Chapter[];
  completions: readonly QuestCompletion[];
  dayCompletions: readonly DayCompletion[];
  currentDay: DayNumber;
  /** Every exam attempt — weekly exams and the Final Battle (their states come from them). */
  examAttempts?: readonly ExamAttempt[];
  /** Pass line per exam quest, where the exam is written. */
  examPassingScores?: ReadonlyMap<string, number>;
};

const DEFAULT_PASSING_SCORE = 0.7;

function examOf(
  plan: DailyChallenge,
  input: JourneyInput,
  byQuest: ReadonlyMap<string, QuestCompletion>,
): JourneyExam | null {
  const quest = plan.quests.find(
    (item) => item.type === 'weeklyExam' || item.type === 'finalBattle',
  );
  if (!quest) return null;
  const attempts = (input.examAttempts ?? []).filter((attempt) => attempt.questId === quest.id);
  const submitted = attempts.filter((attempt) => attempt.submittedAt !== null);
  const completion = byQuest.get(quest.id) ?? null;
  const scores = submitted.map((attempt) => attempt.score ?? 0);
  return {
    questId: quest.id,
    status: examStatus({
      examDay: plan.day,
      currentDay: input.currentDay,
      warmUpDone: plan.quests
        .slice(0, plan.quests.indexOf(quest))
        .every((item) => byQuest.has(item.id)),
      passingScore: input.examPassingScores?.get(quest.id) ?? DEFAULT_PASSING_SCORE,
      attempts,
      completion,
    }),
    bestScore: scores.length > 0 ? Math.max(...scores) : (completion?.score ?? null),
    submittedAttempts: submitted.length,
  };
}

function kindOf(plan: DailyChallenge, chapter: Chapter): JourneyDayKind {
  if (plan.kind === 'summit') return 'summit';
  if (plan.kind === 'weeklyExam') return 'weeklyExam';
  return plan.day === chapter.endDay ? 'chapterEnd' : 'regular';
}

function stateOf(day: DayNumber, completed: boolean, currentDay: DayNumber): JourneyDayState {
  if (completed) return 'completed';
  if (day === currentDay) return 'available';
  return day < currentDay ? 'missed' : 'locked';
}

function chapterOf(chapter: Chapter, days: readonly JourneyDay[], currentDay: DayNumber) {
  const own = days.filter((day) => day.day >= chapter.startDay && day.day <= chapter.endDay);
  const completedDays = own.filter((day) => day.state === 'completed').length;
  const totalDays = chapter.endDay - chapter.startDay + 1;
  const state: JourneyChapter['state'] =
    completedDays === totalDays
      ? 'completed'
      : currentDay > chapter.endDay
        ? 'passed'
        : currentDay >= chapter.startDay
          ? 'current'
          : 'upcoming';
  return { chapter, state, completedDays, totalDays };
}

/**
 * The 90-day map, derived from the challenge state: which days are done,
 * which one is today, what lies ahead. Facts come from storage only — a day
 * without completions has no XP, no date and no perfect status.
 */
export function buildJourney(input: JourneyInput): Journey {
  const { plans, chapters, completions, dayCompletions, currentDay } = input;
  const completedDays = findCompletedDays(plans, completions);
  const records = new Map(dayCompletions.map((record) => [record.day, record]));
  const byQuest = new Map(completions.map((completion) => [completion.questId, completion]));

  const days = [...plans]
    .sort((a, b) => a.day - b.day)
    .map((plan): JourneyDay => {
      const chapter = findChapterForDay(chapters, plan.day);
      const done = plan.quests
        .map((quest) => byQuest.get(quest.id))
        .filter((completion): completion is QuestCompletion => completion !== undefined);
      const completed = completedDays.has(plan.day);
      const record = records.get(plan.day) ?? null;
      const lastDone =
        done
          .map((completion) => completion.completedAt)
          .sort()
          .at(-1) ?? null;

      return {
        day: plan.day,
        chapterId: chapter.id,
        kind: kindOf(plan, chapter),
        state: stateOf(plan.day, completed, currentDay),
        isToday: plan.day === currentDay,
        questCount: plan.quests.length,
        completedQuestCount: done.length,
        xpEarned:
          record?.xpEarned ??
          (done.length > 0 ? done.reduce((sum, completion) => sum + completion.xpEarned, 0) : null),
        isPerfect: completed
          ? (record?.isPerfect ??
            done.every((completion) => completion.correctCount === completion.totalCount))
          : null,
        completedAt: completed ? (record?.completedAt ?? lastDone) : null,
        exam: examOf(plan, input, byQuest),
      };
    });

  const completedCount = days.filter((day) => day.state === 'completed').length;
  return {
    currentDay,
    totalDays: days.length,
    completedDays: completedCount,
    isComplete: completedCount === days.length,
    // The last day is the Final Battle: finishing it is reaching the summit.
    summitReached: days.at(-1)?.state === 'completed',
    chapters: chapters.map((chapter) => chapterOf(chapter, days, currentDay)),
    days,
  };
}

/** Only today's day can be played — and it is played from Home, not from the map. */
export function canStartDay(day: JourneyDay): boolean {
  return day.state === 'available';
}

/** Days until a locked day opens (1 = tomorrow). */
export function daysUntil(day: JourneyDay, currentDay: DayNumber): number {
  return Math.max(0, day.day - currentDay);
}
