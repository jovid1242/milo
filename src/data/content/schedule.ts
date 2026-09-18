import { CHALLENGE } from '@/constants/challenge';
import { findChapterForDay, getDayKind, getWeekForDay } from '@/features/challenge/logic/calendar';
import type { DailyChallenge, DayKind, DayNumber, Quest, QuestType } from '@/schemas';

import { CHAPTERS } from './chapters';

/**
 * The quest structure of all 90 days, in one place.
 *
 * - Regular day: vocabulary → grammar → reading → review (four steps to camp).
 * - Every 7th day: vocabulary → review → weekly exam.
 * - Day 90: review → the summit (the final battle).
 */
const BLUEPRINTS: Record<
  QuestType,
  Pick<Quest, 'title' | 'summary' | 'xpReward' | 'estimatedMinutes'>
> = {
  vocabulary: {
    title: 'Vocabulary',
    summary: `${CHALLENGE.wordsPerVocabularyQuest} new words`,
    xpReward: 20,
    estimatedMinutes: 5,
  },
  grammar: { title: 'Grammar', summary: 'One new rule', xpReward: 15, estimatedMinutes: 6 },
  reading: { title: 'Reading', summary: 'Short story', xpReward: 20, estimatedMinutes: 7 },
  review: { title: 'Review', summary: 'Quick recap', xpReward: 10, estimatedMinutes: 4 },
  weeklyExam: { title: 'Weekly exam', summary: 'Checkpoint', xpReward: 100, estimatedMinutes: 15 },
  finalBattle: {
    title: 'The summit',
    summary: 'Everything you learned',
    xpReward: 250,
    estimatedMinutes: 20,
  },
};

export function questId(day: DayNumber, type: QuestType): string {
  return `d${String(day).padStart(3, '0')}-${type}`;
}

function questTypesFor(kind: DayKind): QuestType[] {
  switch (kind) {
    case 'summit':
      return ['review', 'finalBattle'];
    case 'weeklyExam':
      return ['vocabulary', 'review', 'weeklyExam'];
    case 'regular':
      return ['vocabulary', 'grammar', 'reading', 'review'];
  }
}

function buildQuest(day: DayNumber, type: QuestType): Quest {
  const quest: Quest = { id: questId(day, type), day, type, ...BLUEPRINTS[type] };
  switch (type) {
    case 'vocabulary':
      return { ...quest, wordCount: CHALLENGE.wordsPerVocabularyQuest };
    case 'review':
      // Day 1 has no earlier days yet: its review goes over today's words.
      return day === 1 ? { ...quest, summary: "Today's words again" } : quest;
    case 'weeklyExam':
      return {
        ...quest,
        title: `Week ${getWeekForDay(day)} exam`,
        summary: 'Whole-week checkpoint',
      };
    default:
      return quest;
  }
}

export function buildDailyChallenge(day: DayNumber): DailyChallenge {
  const kind = getDayKind(day);
  return {
    day,
    week: getWeekForDay(day),
    chapterId: findChapterForDay(CHAPTERS, day).id,
    kind,
    quests: questTypesFor(kind).map((type) => buildQuest(day, type)),
  };
}

export function buildAllDailyChallenges(): DailyChallenge[] {
  return Array.from({ length: CHALLENGE.totalDays }, (_, index) => buildDailyChallenge(index + 1));
}
