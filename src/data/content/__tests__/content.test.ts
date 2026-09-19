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
  GrammarQuestSchema,
  QuestContentSchema,
  QuestTypeSchema,
  ReadingQuestSchema,
  ReviewQuestSchema,
  findWholeWord,
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
      expect(plan.quests.map((q) => q.type)).toEqual([
        'vocabulary',
        'grammar',
        'reading',
        'review',
      ]);
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

  it('rejects malformed grammar lessons', () => {
    const lesson = [...QUEST_CONTENT.values()].find((content) => content.type === 'grammar');
    if (lesson?.type !== 'grammar') throw new Error('no grammar content');
    const [first, ...rest] = lesson.exercises;
    const valid = (patch: object) => GrammarQuestSchema.safeParse({ ...lesson, ...patch }).success;
    const withFirst = (exercise: object) =>
      valid({ exercises: [{ ...first, ...exercise }, ...rest] });

    expect(valid({})).toBe(true);
    expect(withFirst({ correctOptionId: 'nope' })).toBe(false);
    expect(withFirst({ explanation: '' })).toBe(false);
    expect(withFirst({ sentence: 'There is no gap here.' })).toBe(false);
    expect(
      withFirst({
        options: [
          { id: 'a', text: 'saw' },
          { id: 'b', text: 'saw' },
        ],
      }),
    ).toBe(false);
    expect(
      valid({ examples: lesson.examples.map((example) => ({ ...example, pointId: 'nope' })) }),
    ).toBe(false);
    expect(
      valid({
        examples: lesson.examples.map((example) => ({
          ...example,
          sentence: { text: example.sentence.text, marks: [{ text: 'missing', kind: 'form' }] },
        })),
      }),
    ).toBe(false);
  });

  it('keeps stories readable and their questions answerable', () => {
    const stories = [...QUEST_CONTENT.values()].filter((content) => content.type === 'reading');
    expect(stories.length).toBeGreaterThan(0);
    for (const reading of stories) {
      const paragraphs = new Map(reading.story.paragraphs.map((p) => [p.id, p.text]));
      for (const word of reading.story.words) {
        expect(
          findWholeWord(paragraphs.get(word.paragraphId) ?? '', word.text),
        ).toBeGreaterThanOrEqual(0);
      }
      for (const question of reading.questions) {
        expect(question.options.map((option) => option.id)).toContain(question.correctOptionId);
      }
      expect(reading.questions.filter((q) => q.kind === 'context').length).toBeLessThanOrEqual(1);
      if (reading.story.level === 'B1') {
        const count = reading.story.paragraphs.reduce(
          (sum, p) => sum + p.text.split(/\s+/).length,
          0,
        );
        expect(count).toBeGreaterThanOrEqual(300);
        expect(count).toBeLessThanOrEqual(450);
      }
    }
  });

  it('rejects malformed reading lessons', () => {
    const lesson = [...QUEST_CONTENT.values()].find(
      (content) => content.type === 'reading' && content.story.level === 'B1',
    );
    if (lesson?.type !== 'reading') throw new Error('no B1 reading content');
    const valid = (patch: object) => ReadingQuestSchema.safeParse({ ...lesson, ...patch }).success;
    const [first, ...rest] = lesson.questions;

    expect(valid({})).toBe(true);
    expect(valid({ questions: [{ ...first, correctOptionId: 'nope' }, ...rest] })).toBe(false);
    expect(
      valid({
        story: {
          ...lesson.story,
          words: [{ ...lesson.story.words[0], text: 'unicorn' }, ...lesson.story.words.slice(1)],
        },
      }),
    ).toBe(false);
    expect(
      valid({
        questions: lesson.questions.map((q) => ({ ...q, kind: 'context', wordId: 'gradually' })),
      }),
    ).toBe(false);
    expect(valid({ questions: [{ ...first, evidence: '' }, ...rest] })).toBe(false);
  });

  it('rejects malformed reviews', () => {
    const lesson = [...QUEST_CONTENT.values()].find(
      (content) => content.type === 'review' && content.exercises.length === 8,
    );
    if (lesson?.type !== 'review') throw new Error('no 8-question review content');
    const valid = (patch: object) => ReviewQuestSchema.safeParse({ ...lesson, ...patch }).success;
    const [first, second, ...rest] = lesson.exercises;
    if (first?.source !== 'vocabulary' || second?.source !== 'grammar') {
      throw new Error('Day 89 review should open with vocabulary, then grammar');
    }

    expect(valid({})).toBe(true);
    // The same exercise twice.
    expect(valid({ exercises: [first, first, ...rest] })).toBe(false);
    // An answer that is not among the options.
    expect(
      valid({
        exercises: [
          first,
          { ...second, exercise: { ...second.exercise, correctOptionId: 'z' } },
          ...rest,
        ],
      }),
    ).toBe(false);
    // Material from a quest the review does not name.
    expect(valid({ sources: { ...lesson.sources, grammar: undefined } })).toBe(false);
    // A recap is short: 4 to 12 questions.
    expect(valid({ exercises: lesson.exercises.slice(0, 3) })).toBe(false);
  });

  it('practises every new word at least once', () => {
    for (const content of QUEST_CONTENT.values()) {
      if (content.type !== 'vocabulary') continue;
      const practised = new Set(content.exercises.map((exercise) => exercise.itemId));
      expect(content.items.filter((item) => !practised.has(item.id))).toEqual([]);
      expect(content.items).toHaveLength(CHALLENGE.wordsPerVocabularyQuest);
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
