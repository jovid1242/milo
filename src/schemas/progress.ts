import { z } from 'zod';

import { AchievementIdSchema } from './achievement';
import { ChapterIdSchema } from './chapter';
import { DayNumberSchema, IdSchema, ScoreSchema, TimestampSchema } from './common';
import { QuestTypeSchema } from './quest';
import { QuizAnswerSchema } from './quiz';

export const CompletionSourceSchema = z.enum(['user', 'dev']);
export type CompletionSource = z.infer<typeof CompletionSourceSchema>;

/** A finished quest, as persisted locally. */
export const QuestCompletionSchema = z.object({
  questId: IdSchema,
  day: DayNumberSchema,
  questType: QuestTypeSchema,
  score: ScoreSchema,
  correctCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  xpEarned: z.number().int().nonnegative(),
  source: CompletionSourceSchema,
  completedAt: TimestampSchema,
});
export type QuestCompletion = z.infer<typeof QuestCompletionSchema>;

export const AnswerRecordSchema = z.object({
  questId: IdSchema,
  questionId: IdSchema,
  answer: QuizAnswerSchema,
  isCorrect: z.boolean(),
  answeredAt: TimestampSchema,
});
export type AnswerRecord = z.infer<typeof AnswerRecordSchema>;

/**
 * A quest the user has opened but not finished yet. A completion replaces it,
 * so "in progress" is simply: a session exists and no completion does.
 */
export const QuestSessionSchema = z.object({
  questId: IdSchema,
  startedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  /** Share of the quest already done, 0…1. */
  progress: ScoreSchema,
  /**
   * Where the user is inside the quest. Each quest type owns (and validates)
   * its own shape, e.g. `VocabularyProgress`; storage treats it as plain JSON.
   */
  state: z.json().nullable(),
});
export type QuestSession = z.infer<typeof QuestSessionSchema>;

/**
 * A finished challenge day: written once, when every quest of the day is done.
 * The streak itself stays derived from completed days; the record keeps the
 * moment — what the day earned, the streak it made, and whether it was
 * celebrated yet (the celebration plays once, ever).
 */
export const DayCompletionSchema = z.object({
  day: DayNumberSchema,
  completedAt: TimestampSchema,
  questCount: z.number().int().positive(),
  /** XP from the day's quests, perfect bonuses included. */
  xpEarned: z.number().int().nonnegative(),
  streakBefore: z.number().int().nonnegative(),
  streakAfter: z.number().int().nonnegative(),
  /** Every scored answer of every quest that day was right (first attempts). */
  isPerfect: z.boolean(),
  celebratedAt: TimestampSchema.nullable(),
});
export type DayCompletion = z.infer<typeof DayCompletionSchema>;

export const XpEventReasonSchema = z.enum(['quest', 'achievement', 'dev']);
export type XpEventReason = z.infer<typeof XpEventReasonSchema>;

export const XpEventSchema = z.object({
  amount: z.number().int(),
  reason: XpEventReasonSchema,
  refId: IdSchema.nullable(),
  createdAt: TimestampSchema,
});
export type XpEvent = z.infer<typeof XpEventSchema>;

export const LevelInfoSchema = z.object({
  level: z.number().int().min(1),
  xpIntoLevel: z.number().int().nonnegative(),
  xpForNextLevel: z.number().int().positive(),
  progress: ScoreSchema,
});
export type LevelInfo = z.infer<typeof LevelInfoSchema>;

/** Derived, read-only view of the user's challenge progress. */
export const ProgressStateSchema = z.object({
  currentDay: DayNumberSchema,
  chapterId: ChapterIdSchema,
  totalXp: z.number().int().nonnegative(),
  level: LevelInfoSchema,
  streak: z.number().int().nonnegative(),
  completedDays: z.array(DayNumberSchema),
  wordsLearned: z.number().int().nonnegative(),
  todayCompletedQuestIds: z.array(IdSchema),
  isTodayComplete: z.boolean(),
  hasPerfectQuiz: z.boolean(),
  unlockedAchievementIds: z.array(AchievementIdSchema),
});
export type ProgressState = z.infer<typeof ProgressStateSchema>;

/** Weekly exam outcome, derived from the exam quest completion. */
export const ExamResultSchema = z.object({
  week: z.number().int().min(1),
  day: DayNumberSchema,
  score: ScoreSchema,
  passed: z.boolean(),
  takenAt: TimestampSchema,
});
export type ExamResult = z.infer<typeof ExamResultSchema>;
