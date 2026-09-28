import { z } from 'zod';

import { badges, quests as questIcons, sounds } from '@/constants/assets';
import { ACHIEVEMENTS } from '@/data/content/achievements';
import { AchievementSchema, QuestTypeSchema } from '@/schemas';

// Course content (days, words, exams) is tested with the course: content/course/__tests__.

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
