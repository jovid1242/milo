import type { GrammarLesson, LessonQuestDefinition, ReadingText, VocabularyItem } from '@/schemas';

/**
 * How one day is authored: the material it introduces and the content of its
 * quests, together in one file — so a day reads as a lesson. The course index
 * gathers every day's material into the course's banks; the course itself
 * stays normalized (material once, references everywhere else).
 */
export type DayContent = {
  /** Words the day's Vocabulary quest teaches. */
  vocabulary: VocabularyItem[];
  /** The lesson its Grammar quest teaches. */
  grammar: GrammarLesson[];
  /** The text its Reading quest reads. */
  readings: ReadingText[];
  /** The day's quests, by reference into the banks. */
  lessons: LessonQuestDefinition[];
};
