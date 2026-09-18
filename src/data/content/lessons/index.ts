import type { QuestContent } from '@/schemas';

import { DAY_001 } from './day-001';

/** All authored quest content, keyed by quest id. Days without content return null. */
export const QUEST_CONTENT: ReadonlyMap<string, QuestContent> = new Map(
  [...DAY_001].map((content) => [content.questId, content]),
);
