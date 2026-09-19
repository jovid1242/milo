import type { QuestContent } from '@/schemas';

import { FINAL_CHALLENGE } from '../exams/final-challenge';
import { WEEK_12_EXAM } from '../exams/week-12';
import { DAY_001 } from './day-001';
import { DAY_089 } from './day-089';

/** All authored quest content, keyed by quest id. Days without content return null. */
export const QUEST_CONTENT: ReadonlyMap<string, QuestContent> = new Map(
  [...DAY_001, ...DAY_089, WEEK_12_EXAM, FINAL_CHALLENGE].map((content) => [
    content.questId,
    content,
  ]),
);
