import { z } from 'zod';

import { DayNumberSchema } from './common';

/** Ids match the chapter illustration keys in the asset registry. */
export const ChapterIdSchema = z.enum(['beginning', 'momentum', 'habit', 'growth', 'summit']);
export type ChapterId = z.infer<typeof ChapterIdSchema>;

export const ChapterSchema = z
  .object({
    id: ChapterIdSchema,
    number: z.number().int().min(1),
    title: z.string().min(1),
    tagline: z.string().min(1),
    startDay: DayNumberSchema,
    endDay: DayNumberSchema,
  })
  .refine((chapter) => chapter.endDay >= chapter.startDay, {
    message: 'endDay must not be before startDay',
    path: ['endDay'],
  });
export type Chapter = z.infer<typeof ChapterSchema>;
