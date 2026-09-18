import { z } from 'zod';

import { CHALLENGE } from '@/constants/challenge';
import { ACHIEVEMENTS } from '@/data/content/achievements';
import { CHAPTERS } from '@/data/content/chapters';
import { QUEST_CONTENT } from '@/data/content/lessons';
import { buildAllDailyChallenges } from '@/data/content/schedule';
import { badges, quests as questIcons, sounds } from '@/constants/assets';
import {
  AchievementSchema,
  ChapterSchema,
  DailyChallengeSchema,
  QuestContentSchema,
  QuestTypeSchema,
} from '@/schemas';

const PLANS = buildAllDailyChallenges();

describe('chapters', () => {
  it('validate and cover every day exactly once', () => {
    z.array(ChapterSchema).parse(CHAPTERS);
    expect(CHAPTERS[0]?.startDay).toBe(1);
    expect(CHAPTERS.at(-1)?.endDay).toBe(CHALLENGE.totalDays);
    CHAPTERS.forEach((chapter, index) => {
      const previous = CHAPTERS[index - 1];
      if (previous) expect(chapter.startDay).toBe(previous.endDay + 1);
    });
  });
});

describe('schedule', () => {
  it('builds a valid plan for all 90 days', () => {
    expect(PLANS).toHaveLength(CHALLENGE.totalDays);
    z.array(DailyChallengeSchema).parse(PLANS);
  });

  it('uses unique quest ids', () => {
    const ids = PLANS.flatMap((plan) => plan.quests.map((quest) => quest.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places weekly exams and the summit', () => {
    const examDays = PLANS.filter((plan) => plan.kind === 'weeklyExam').map((plan) => plan.day);
    expect(examDays).toEqual([7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84]);
    expect(PLANS.filter((plan) => plan.kind === 'summit').map((plan) => plan.day)).toEqual([90]);
    expect(PLANS.find((plan) => plan.day === 7)?.quests.map((q) => q.type)).toContain('weeklyExam');
  });

  it('gives every regular day the same four-step route', () => {
    for (const plan of PLANS.filter((item) => item.kind === 'regular')) {
      expect(plan.quests.map((q) => q.type)).toEqual(['vocabulary', 'grammar', 'reading', 'review']);
    }
    expect(PLANS.find((plan) => plan.day === 7)?.quests.map((q) => q.type)).toEqual([
      'vocabulary',
      'review',
      'weeklyExam',
    ]);
    expect(PLANS.at(-1)?.quests.map((q) => q.type)).toEqual(['review', 'finalBattle']);
  });

  it('rewards 65 XP for a regular day', () => {
    const day12 = PLANS.find((plan) => plan.day === 12);
    expect(day12?.quests.reduce((sum, quest) => sum + quest.xpReward, 0)).toBe(65);
  });
});

describe('authored lesson content', () => {
  it('validates and points at real quests', () => {
    const questIds = new Set(PLANS.flatMap((plan) => plan.quests.map((quest) => quest.id)));
    for (const content of QUEST_CONTENT.values()) {
      QuestContentSchema.parse(content);
      expect(questIds.has(content.questId)).toBe(true);
    }
  });
});

describe('achievements', () => {
  it('validate and have a badge asset each', () => {
    z.array(AchievementSchema).parse(ACHIEVEMENTS);
    for (const achievement of ACHIEVEMENTS) {
      expect(badges[achievement.id]).toBeDefined();
    }
  });
});

describe('asset registry', () => {
  it('has an icon for every quest type except the missing grammar icon', () => {
    const iconKeys = new Set(Object.keys(questIcons));
    const missing = QuestTypeSchema.options.filter((type) => !iconKeys.has(type));
    expect(missing).toEqual(['grammar']);
  });

  it('exposes all 15 sound effects', () => {
    expect(Object.keys(sounds)).toHaveLength(15);
  });
});
