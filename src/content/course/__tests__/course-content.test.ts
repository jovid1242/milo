import { CHALLENGE } from '@/constants/challenge';
import { LOCAL_COURSE } from '@/content/course';
import { indexCourse } from '@/features/course/logic/course-index';
import { resolveQuestContent } from '@/features/course/logic/resolve';
import { validateCourse } from '@/features/course/logic/validate';
import {
  GrammarQuestSchema,
  QuestContentSchema,
  ReadingQuestSchema,
  ReviewQuestSchema,
  findWholeWord,
  type QuestContent,
} from '@/schemas';

/**
 * The bundled course itself: the plan of all 90 days, and the quality of the
 * days written so far. (The rules every course must follow are tested with
 * the validator in features/course.)
 */

const DAYS = LOCAL_COURSE.days;
const INDEX = indexCourse(LOCAL_COURSE);
const CONTENTS: QuestContent[] = DAYS.flatMap((day) => day.quests)
  .map((quest) => resolveQuestContent(INDEX, quest.id))
  .filter((content): content is QuestContent => content !== null);
const ofType = <T extends QuestContent['type']>(type: T) =>
  CONTENTS.filter(
    (content): content is Extract<QuestContent, { type: T }> => content.type === type,
  );

describe('the bundled course', () => {
  it('passes the course validator without errors', () => {
    const result = validateCourse(LOCAL_COURSE, { expectedTotalDays: CHALLENGE.totalDays });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('has an identity and a version progress can refer to', () => {
    expect(LOCAL_COURSE.id).toBe('milo-english-90');
    expect(LOCAL_COURSE.version).toBeGreaterThanOrEqual(1);
    expect(LOCAL_COURSE.language).toBe('en');
    expect(LOCAL_COURSE.supportLanguage).toBe('ru');
  });

  it('keeps its chapters back to back over all 90 days', () => {
    const chapters = LOCAL_COURSE.chapters;
    expect(chapters[0]?.startDay).toBe(1);
    expect(chapters.at(-1)?.endDay).toBe(CHALLENGE.totalDays);
    chapters.forEach((chapter, index) => {
      const previous = chapters[index - 1];
      if (previous) expect(chapter.startDay).toBe(previous.endDay + 1);
    });
  });
});

describe('the plan of 90 days', () => {
  it('defines every day, in order, with unique quest ids', () => {
    expect(DAYS.map((day) => day.day)).toEqual(Array.from({ length: 90 }, (_, i) => i + 1));
    const ids = DAYS.flatMap((day) => day.quests.map((quest) => quest.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places weekly exams and the summit', () => {
    const examDays = DAYS.filter((day) => day.kind === 'weeklyExam').map((day) => day.day);
    expect(examDays).toEqual([7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84]);
    expect(DAYS.filter((day) => day.kind === 'summit').map((day) => day.day)).toEqual([90]);
  });

  it('gives every regular day the same four-step route', () => {
    for (const day of DAYS.filter((item) => item.kind === 'regular')) {
      expect(day.quests.map((q) => q.type)).toEqual(['vocabulary', 'grammar', 'reading', 'review']);
    }
    expect(DAYS[6]?.quests.map((q) => q.type)).toEqual(['vocabulary', 'review', 'weeklyExam']);
    expect(DAYS.at(-1)?.quests.map((q) => q.type)).toEqual(['finalBattle']);
  });

  it('rewards 65 XP for a regular day', () => {
    expect(DAYS[11]?.quests.reduce((sum, quest) => sum + quest.xpReward, 0)).toBe(65);
  });

  it('never gets easier as it goes on', () => {
    const ranks = DAYS.map((day) => ['A1', 'A2', 'B1', 'B2', 'C1'].indexOf(day.level));
    ranks.forEach((rank, index) => expect(rank).toBeGreaterThanOrEqual(ranks[index - 1] ?? 0));
  });
});

describe('the days written so far', () => {
  it('resolve into content the game can play', () => {
    expect(CONTENTS.length).toBeGreaterThan(0);
    for (const content of CONTENTS) QuestContentSchema.parse(content);
  });

  it('cover Day 1 completely: all four quests', () => {
    expect(CONTENTS.filter((content) => content.questId.startsWith('d001-'))).toHaveLength(4);
  });

  it('practise every new word at least once, six words a day', () => {
    for (const content of ofType('vocabulary')) {
      const practised = new Set(content.exercises.map((exercise) => exercise.itemId));
      expect(content.items.filter((item) => !practised.has(item.id))).toEqual([]);
      expect(content.items).toHaveLength(6);
    }
  });

  it('keep stories readable and their questions answerable', () => {
    const readings = ofType('reading');
    expect(readings.length).toBeGreaterThan(0);
    for (const reading of readings) {
      const paragraphs = new Map(reading.story.paragraphs.map((p) => [p.id, p.text]));
      for (const word of reading.story.words) {
        expect(
          findWholeWord(paragraphs.get(word.paragraphId) ?? '', word.text),
        ).toBeGreaterThanOrEqual(0);
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

  it('reuse the word bank in reading instead of copying meanings', () => {
    const glosses = LOCAL_COURSE.readings.flatMap((reading) => reading.story.words);
    const referenced = glosses.filter((gloss) => gloss.vocabularyId);
    expect(referenced.length).toBeGreaterThan(0);
    for (const gloss of referenced) {
      expect(gloss.translation).toBeUndefined();
      expect(gloss.definition).toBeUndefined();
    }
  });

  it('come back to earlier days in later reviews', () => {
    const day2 = resolveQuestContent(INDEX, 'd002-review');
    if (day2?.type !== 'review') throw new Error('Day 2 has a review');
    expect(day2.material.words.map((word) => word.id)).toEqual(
      expect.arrayContaining(['vocab-habit', 'vocab-practice']),
    );
    expect(day2.material.points.map((point) => point.id)).toContain(
      'grammar-present-simple-habits.third-person',
    );
  });
});

describe('gameplay schemas reject malformed content', () => {
  it('grammar', () => {
    const lesson = ofType('grammar')[0];
    if (!lesson) throw new Error('no grammar content');
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
  });

  it('reading', () => {
    const lesson = ofType('reading').find((content) => content.story.level === 'B1');
    if (!lesson) throw new Error('no B1 reading content');
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
    expect(valid({ questions: [{ ...first, evidence: '' }, ...rest] })).toBe(false);
  });

  it('review', () => {
    const lesson = ofType('review').find((content) => content.exercises.length === 8);
    if (!lesson) throw new Error('no 8-question review content');
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
    // Material the review does not carry.
    expect(valid({ material: { ...lesson.material, points: [] } })).toBe(false);
    // A recap is short: 4 to 12 questions.
    expect(valid({ exercises: lesson.exercises.slice(0, 3) })).toBe(false);
  });
});
