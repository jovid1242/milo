import { z } from 'zod';

import { CHAPTERS } from '@/data/content/chapters';
import { QUEST_CONTENT } from '@/data/content/lessons';
import { buildAllDailyChallenges } from '@/data/content/schedule';
import type { ChallengeRepository } from '@/data/repositories/types';
import {
  ChapterSchema,
  DailyChallengeSchema,
  QuestContentSchema,
  type Chapter,
  type DailyChallenge,
  type DayNumber,
  type QuestContent,
} from '@/schemas';

type ValidatedContent = { chapters: Chapter[]; dailyChallenges: DailyChallenge[] };

let content: ValidatedContent | null = null;

/** Static content is parsed once, so malformed content fails loudly and early. */
function loadContent(): ValidatedContent {
  content ??= {
    chapters: z.array(ChapterSchema).parse(CHAPTERS),
    dailyChallenges: z.array(DailyChallengeSchema).parse(buildAllDailyChallenges()),
  };
  return content;
}

export class LocalChallengeRepository implements ChallengeRepository {
  async getChapters(): Promise<Chapter[]> {
    return loadContent().chapters;
  }

  async getDailyChallenges(): Promise<DailyChallenge[]> {
    return loadContent().dailyChallenges;
  }

  async getDailyChallenge(day: DayNumber): Promise<DailyChallenge> {
    const plan = loadContent().dailyChallenges.find((item) => item.day === day);
    if (!plan) throw new Error(`No daily challenge for day ${day}`);
    return plan;
  }

  async getQuestContent(questId: string): Promise<QuestContent | null> {
    const raw = QUEST_CONTENT.get(questId);
    return raw ? QuestContentSchema.parse(raw) : null;
  }
}
