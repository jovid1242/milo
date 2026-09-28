import { z } from 'zod';

import { CHALLENGE } from '@/constants/challenge';

export const IdSchema = z.string().min(1);

export const DayNumberSchema = z.number().int().min(1).max(CHALLENGE.totalDays);
export type DayNumber = z.infer<typeof DayNumberSchema>;

/** Calendar date in the device's local time zone, `YYYY-MM-DD`. */
export const LocalDateSchema = z.iso.date();
export type LocalDate = z.infer<typeof LocalDateSchema>;

/** UTC timestamp as produced by `Date#toISOString()`. */
export const TimestampSchema = z.iso.datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

/** Share of correct answers, 0…1. */
export const ScoreSchema = z.number().min(0).max(1);

/**
 * CEFR level of a piece of content (a word, a grammar lesson, a text) or of a
 * course day. Only as much difficulty metadata as the course needs to check
 * that it never gets easier without a reason.
 */
export const CefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1']);
export type CefrLevel = z.infer<typeof CefrLevelSchema>;
export const CEFR_LEVELS = CefrLevelSchema.options;
