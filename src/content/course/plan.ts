import { dayId, questId } from '@/features/course/logic/ids';
import type {
  CefrLevel,
  Chapter,
  ChapterId,
  CourseDay,
  DayKind,
  DayNumber,
  Quest,
  QuestType,
} from '@/schemas';

/**
 * The course's plan: which kind of day each of the 90 days is and which
 * quests make it up. This is where the course design lives — a checkpoint
 * every seventh day, the summit on the last one — so the app never works it
 * out from a day number: it reads `CourseDay.kind`.
 *
 * - Regular day: vocabulary → grammar → reading → review (four steps to camp).
 * - Checkpoint (every 7th day): vocabulary → review → weekly exam.
 * - Summit (the last day): the Final Battle alone — one last climb.
 */

const CHECKPOINT_EVERY = 7;
const WORDS_PER_DAY = 6;

/** The level each chapter works at; days never get easier as the course goes on. */
const LEVEL: Record<ChapterId, CefrLevel> = {
  beginning: 'A2',
  momentum: 'A2',
  habit: 'B1',
  growth: 'B1',
  summit: 'B1',
};

const SLOTS: Record<
  QuestType,
  Pick<Quest, 'title' | 'summary' | 'xpReward' | 'estimatedMinutes'>
> = {
  vocabulary: {
    title: 'Vocabulary',
    summary: `${WORDS_PER_DAY} new words`,
    xpReward: 20,
    estimatedMinutes: 5,
  },
  grammar: { title: 'Grammar', summary: 'One new rule', xpReward: 15, estimatedMinutes: 6 },
  reading: { title: 'Reading', summary: 'Short story', xpReward: 20, estimatedMinutes: 5 },
  review: { title: 'Review', summary: 'Quick recap', xpReward: 10, estimatedMinutes: 3 },
  // The exam's own content states the same reward and time; the course
  // validator keeps the two in step.
  weeklyExam: {
    title: 'Weekly exam',
    summary: 'Checkpoint',
    xpReward: 100,
    estimatedMinutes: 10,
  },
  finalBattle: {
    title: 'Final Battle',
    summary: 'Everything you learned',
    xpReward: 250,
    estimatedMinutes: 15,
  },
};

function kindOf(day: DayNumber, totalDays: number): DayKind {
  if (day === totalDays) return 'summit';
  if (day % CHECKPOINT_EVERY === 0) return 'weeklyExam';
  return 'regular';
}

function questTypesFor(kind: DayKind): QuestType[] {
  switch (kind) {
    case 'summit':
      return ['finalBattle'];
    case 'weeklyExam':
      return ['vocabulary', 'review', 'weeklyExam'];
    case 'regular':
      return ['vocabulary', 'grammar', 'reading', 'review'];
  }
}

function slot(day: DayNumber, week: number, type: QuestType): Quest {
  const quest: Quest = { id: questId(day, type), day, type, ...SLOTS[type] };
  switch (type) {
    case 'vocabulary':
      return { ...quest, wordCount: WORDS_PER_DAY };
    case 'review':
      // Day 1 has no earlier days yet: its review goes over today's words.
      return day === 1 ? { ...quest, summary: "Today's words again" } : quest;
    case 'weeklyExam':
      return { ...quest, title: `Week ${week} exam`, summary: 'Whole-week checkpoint' };
    default:
      return quest;
  }
}

function chapterOf(chapters: readonly Chapter[], day: DayNumber): Chapter {
  const chapter = chapters.find((item) => day >= item.startDay && day <= item.endDay);
  if (!chapter) throw new Error(`No chapter covers day ${day}`);
  return chapter;
}

/** Every day of the course, in order. */
export function buildCourseDays(chapters: readonly Chapter[], totalDays: number): CourseDay[] {
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const week = Math.ceil(day / CHECKPOINT_EVERY);
    const kind = kindOf(day, totalDays);
    const chapter = chapterOf(chapters, day);
    return {
      id: dayId(day),
      day,
      week,
      chapterId: chapter.id,
      kind,
      level: LEVEL[chapter.id],
      quests: questTypesFor(kind).map((type) => slot(day, week, type)),
    };
  });
}
