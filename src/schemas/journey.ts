import { z } from 'zod';

import { ChapterIdSchema, ChapterSchema } from './chapter';
import { DayNumberSchema, TimestampSchema } from './common';

/**
 * The 90-day map is a view of the challenge state — it adds no progress of its
 * own. These schemas describe that derived view (built by `buildJourney`).
 */

/** Where a day stands: done, today's (still open), passed without its quests, or ahead. */
export const JourneyDayStateSchema = z.enum(['completed', 'available', 'missed', 'locked']);
export type JourneyDayState = z.infer<typeof JourneyDayStateSchema>;

/** What kind of stop a day is on the route. */
export const JourneyDayKindSchema = z.enum(['regular', 'weeklyExam', 'chapterEnd', 'summit']);
export type JourneyDayKind = z.infer<typeof JourneyDayKindSchema>;

export const JourneyDaySchema = z.object({
  day: DayNumberSchema,
  chapterId: ChapterIdSchema,
  kind: JourneyDayKindSchema,
  state: JourneyDayStateSchema,
  /** The calendar's current day (completed or not). */
  isToday: z.boolean(),
  questCount: z.number().int().positive(),
  completedQuestCount: z.number().int().nonnegative(),
  /** Stored facts only — `null` while nothing is known (no fake stats). */
  xpEarned: z.number().int().nonnegative().nullable(),
  isPerfect: z.boolean().nullable(),
  completedAt: TimestampSchema.nullable(),
});
export type JourneyDay = z.infer<typeof JourneyDaySchema>;

/**
 * `completed`: every day done. `passed`: behind the user, with missed days.
 * `current`: today is in it. `upcoming`: not reached yet.
 */
export const JourneyChapterStateSchema = z.enum(['completed', 'passed', 'current', 'upcoming']);
export type JourneyChapterState = z.infer<typeof JourneyChapterStateSchema>;

export const JourneyChapterSchema = z.object({
  chapter: ChapterSchema,
  state: JourneyChapterStateSchema,
  completedDays: z.number().int().nonnegative(),
  totalDays: z.number().int().positive(),
});
export type JourneyChapter = z.infer<typeof JourneyChapterSchema>;

export const JourneySchema = z
  .object({
    currentDay: DayNumberSchema,
    totalDays: z.number().int().positive(),
    /** Fully completed days of the whole challenge. */
    completedDays: z.number().int().nonnegative(),
    /** Every day done: 90 of 90. */
    isComplete: z.boolean(),
    chapters: z.array(JourneyChapterSchema).min(1),
    /** Day 1 first; one entry per challenge day. */
    days: z.array(JourneyDaySchema).min(1),
  })
  .superRefine((journey, ctx) => {
    journey.days.forEach((day, index) => {
      if (day.day !== index + 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'days must run 1…n in order',
          path: ['days', index],
        });
      }
    });
    if (journey.days.filter((day) => day.isToday).length !== 1) {
      ctx.addIssue({ code: 'custom', message: 'exactly one day is today', path: ['days'] });
    }
  });
export type Journey = z.infer<typeof JourneySchema>;
