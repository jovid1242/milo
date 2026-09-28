import { LOCAL_COURSE } from '@/content/course';
import type { Course } from '@/schemas';

import { validateCourse, type CourseIssue } from '../logic/validate';

/** A fresh, mutable copy of the bundled course to break on purpose. */
const course = (): Course => structuredClone(LOCAL_COURSE);

const errorsOf = (input: unknown): CourseIssue[] =>
  validateCourse(input, { expectedTotalDays: 90 }).issues.filter(
    (issue) => issue.severity === 'error',
  );

/** Finds the one error that matters, by where it is and what it says. */
const expectError = (input: unknown, path: string, message: RegExp) => {
  const errors = errorsOf(input);
  expect(errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path, message: expect.stringMatching(message) }),
    ]),
  );
};

function lesson<T extends Course['lessons'][number]['type']>(c: Course, questId: string, type: T) {
  const found = c.lessons.find((item) => item.questId === questId);
  if (found?.type !== type) throw new Error(`${questId} is not a ${type} quest`);
  return found as Extract<Course['lessons'][number], { type: T }>;
}

describe('validateCourse', () => {
  it('accepts the bundled representative course', () => {
    const result = validateCourse(LOCAL_COURSE, { expectedTotalDays: 90 });
    expect(errorsOf(LOCAL_COURSE)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.course?.version).toBe(1);
  });

  it('only warns about what is not written yet', () => {
    const warnings = validateCourse(LOCAL_COURSE).issues.filter((i) => i.severity === 'warning');
    expect(warnings.map((warning) => warning.path)).toEqual([
      'exam-week-12.coveredDays',
      'final-challenge.coveredDays',
    ]);
  });

  describe('ids', () => {
    it('rejects a word id used twice', () => {
      const c = course();
      const word = c.vocabulary[0];
      if (!word) throw new Error('no words');
      c.vocabulary.push({ ...word });
      expectError(c, 'vocabulary[vocab-journey]', /duplicate id "vocab-journey"/);
    });

    it('rejects a day id used twice', () => {
      const c = course();
      const second = c.days[1];
      if (!second) throw new Error('no day 2');
      second.id = 'd001';
      expectError(c, 'd001', /duplicate id "d001"/);
    });

    it('rejects a question id used twice across the course', () => {
      const c = course();
      const exam = c.checkpoints[0];
      const question = exam?.questions[0];
      if (!exam || !question) throw new Error('no week 1 exam');
      question.id = 'd001-vocab-1';
      expectError(c, 'exam-week-01.questions[0]', /duplicate id "d001-vocab-1"/);
    });

    it('rejects the course id reused by something else', () => {
      const c = course();
      const reading = c.readings[0];
      if (!reading) throw new Error('no readings');
      c.id = reading.id;
      expectError(c, `readings[${reading.id}]`, /duplicate id/);
    });

    it('keeps bank ids to their convention', () => {
      const c = course();
      const word = c.vocabulary.find((item) => item.id === 'vocab-rest');
      if (!word) throw new Error('no vocab-rest');
      word.id = 'rest';
      expectError(c, 'vocabulary[rest]', /vocab-<lemma>/);
    });
  });

  describe('references', () => {
    it('rejects a vocabulary quest teaching a word the bank does not have', () => {
      const c = course();
      const quest = lesson(c, 'd001-vocabulary', 'vocabulary');
      // Renamed in the quest only — the quest is consistent, the bank is not.
      const rename = (id: string) => (id === 'vocab-journey' ? 'vocab-xyz' : id);
      quest.wordIds = quest.wordIds.map(rename);
      for (const exercise of quest.exercises) {
        exercise.itemId = rename(exercise.itemId);
        exercise.optionItemIds = exercise.optionItemIds.map(rename);
      }
      expectError(c, 'd001-vocabulary.wordIds[0]', /unknown vocabulary id "vocab-xyz"/);
    });

    it('names each exercise practising a word its quest does not list', () => {
      const c = course();
      lesson(c, 'd001-vocabulary', 'vocabulary').wordIds[0] = 'vocab-xyz';
      // The shape is already wrong, so Zod answers — still by id, not by index.
      expect(errorsOf(c).map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['d001-vocabulary.exercises[0]']),
      );
    });

    it('names the exact place a review refers to an unknown word', () => {
      const c = course();
      const item = lesson(c, 'd002-review', 'review').exercises[0];
      if (item?.source !== 'vocabulary') throw new Error('Day 2 review opens with a word');
      item.exercise.optionItemIds = ['vocab-routine', 'vocab-xyz', 'vocab-goal', 'vocab-quiet'];
      expectError(c, 'd002-review.exercises[0].itemId', /unknown vocabulary id "vocab-xyz"/);
    });

    it('rejects a review of material taught only later', () => {
      const c = course();
      const item = lesson(c, 'd002-review', 'review').exercises[0];
      if (item?.source !== 'vocabulary') throw new Error('Day 2 review opens with a word');
      // "mistake" is taught on Day 7.
      item.exercise.optionItemIds = ['vocab-routine', 'vocab-mistake', 'vocab-goal', 'vocab-quiet'];
      expectError(c, 'd002-review.exercises[0].itemId', /taught on d007, after d002/);
    });

    it('rejects a review of an unknown grammar point', () => {
      const c = course();
      const item = lesson(c, 'd002-review', 'review').exercises[1];
      if (item?.source !== 'grammar') throw new Error('second exercise is grammar');
      item.pointId = 'grammar-nope.base';
      expectError(c, 'd002-review.exercises[1].pointId', /unknown grammar point/);
    });

    it('rejects content for a quest the plan does not have', () => {
      const c = course();
      c.lessons.push({
        type: 'grammar',
        questId: 'd007-grammar',
        lessonId: 'grammar-present-simple-habits',
      });
      expectError(c, 'd007-grammar', /no quest with this id in the course plan/);
    });

    it('rejects material taught twice', () => {
      const c = course();
      lesson(c, 'd002-grammar', 'grammar').lessonId = 'grammar-present-simple-habits';
      expectError(c, 'd002-grammar.lessonId', /already taught by d001-grammar/);
    });

    it('rejects a highlighted word pointing at a word from the future', () => {
      const c = course();
      const gloss = c.readings.find((r) => r.id === 'reading-milo-packs-his-backpack')?.story
        .words[0];
      if (!gloss) throw new Error('Day 1 reading has glosses');
      gloss.vocabularyId = 'vocab-routine'; // taught on Day 2
      expectError(
        c,
        'reading-milo-packs-his-backpack.story.words[0].vocabularyId',
        /taught on d002, after d001/,
      );
    });
  });

  describe('days and chapters', () => {
    it('rejects a day filed under the wrong chapter', () => {
      const c = course();
      const day = c.days[14];
      if (!day) throw new Error('no day 15');
      day.chapterId = 'beginning';
      expectError(c, 'd015.chapterId', /day 15 is in chapter "momentum", not "beginning"/);
    });

    it('rejects a day number outside the course', () => {
      const c = course();
      const day = c.days[89];
      if (!day) throw new Error('no day 90');
      day.day = 91;
      // Zod already refuses a day number the app cannot hold.
      expect(errorsOf(c).map((issue) => issue.path)).toEqual(
        expect.arrayContaining([expect.stringMatching(/^d090\.day/)]),
      );
    });

    it('rejects a day defined twice', () => {
      const c = course();
      const day = c.days[1];
      if (!day) throw new Error('no day 2');
      day.day = 1;
      day.quests.forEach((quest) => (quest.day = 1));
      expectError(c, 'd002.day', /day 1 is defined twice \(also d001\)/);
      expectError(c, 'course.days', /day 2 is missing/);
    });

    it('rejects chapters that leave a gap', () => {
      const c = course();
      const momentum = c.chapters[1];
      if (!momentum) throw new Error('no chapter 2');
      momentum.startDay = 12;
      expectError(c, 'chapters[momentum].startDay', /starts on day 12/);
    });

    it('rejects a course whose length the app cannot run', () => {
      const c = course();
      c.totalDays = 91;
      expectError(c, 'course.totalDays', /91 days but the app runs 90/);
    });

    it('rejects a course that gets easier', () => {
      const c = course();
      const day = c.days[40];
      if (!day) throw new Error('no day 41');
      day.level = 'A1';
      expectError(c, 'd041.level', /never gets easier/);
    });

    it('keeps material to its day’s level', () => {
      const c = course();
      const reading = c.readings.find((r) => r.id === 'reading-milo-packs-his-backpack');
      if (!reading) throw new Error('no Day 1 reading');
      reading.story.level = 'B2';
      expectError(c, 'd001-reading.readingId', /B2 material on a A2 day is too hard/);
    });
  });

  describe('the summit', () => {
    it('is the last day', () => {
      const c = course();
      const day89 = c.days[88];
      const day90 = c.days[89];
      if (!day89 || !day90) throw new Error('no days 89–90');
      day89.kind = 'summit';
      expectError(c, 'course.days', /2 summit days/);
      expectError(c, 'd089.kind', /the summit is the last day/);
    });

    it('is the Final Battle alone', () => {
      const c = course();
      const day90 = c.days[89];
      const review = c.days[88]?.quests[3];
      if (!day90 || !review) throw new Error('no days 89–90');
      day90.quests.unshift({ ...review, id: 'd090-review', day: 90 });
      expectError(c, 'd090.quests', /the Final Battle alone/);
    });

    it('keeps the Final Battle on the last day', () => {
      const c = course();
      if (!c.finalChallenge) throw new Error('no final');
      c.finalChallenge.questId = 'd089-review';
      expectError(c, 'final-challenge.questId', /is a review quest, not a finalBattle/);
    });
  });

  describe('exams', () => {
    it('rejects a question testing material from the future', () => {
      const c = course();
      const question = c.checkpoints[0]?.questions[0];
      if (!question) throw new Error('no week 1 exam');
      // Taught on Day 7, the exam's own day — not before it.
      question.materialIds = ['vocab-proud'];
      expectError(c, 'exam-week-01.questions[0].materialIds[0]', /taught on d007/);
    });

    it('rejects a question about unknown material', () => {
      const c = course();
      const question = c.checkpoints[0]?.questions[0];
      if (!question) throw new Error('no week 1 exam');
      question.materialIds = ['vocab-xyz'];
      expectError(c, 'exam-week-01.questions[0].materialIds[0]', /unknown material "vocab-xyz"/);
    });

    it('rejects covered days that are not before the exam', () => {
      const c = course();
      const exam = c.checkpoints[0];
      if (!exam) throw new Error('no week 1 exam');
      exam.coveredDays = [1, 2, 7];
      expectError(c, 'exam-week-01.coveredDays[2]', /covered days must come before the exam day/);
    });

    it('rejects an invalid passing score', () => {
      for (const passingScore of [0, 1.2, -0.5]) {
        const c = course();
        const exam = c.checkpoints[0];
        if (!exam) throw new Error('no week 1 exam');
        exam.passingScore = passingScore;
        expect(errorsOf(c).map((issue) => issue.path)).toContain('exam-week-01.passingScore');
      }
    });

    it('rejects a reward different from the one its quest shows', () => {
      const c = course();
      const exam = c.checkpoints[0];
      if (!exam) throw new Error('no week 1 exam');
      exam.xpReward = 150;
      expectError(c, 'exam-week-01.xpReward', /pays 150 XP but its quest shows 100/);
    });

    it('rejects a malformed Final Battle', () => {
      const c = course();
      if (!c.finalChallenge) throw new Error('no final');
      c.finalChallenge.coveredDays = [85, 86, 89];
      expectError(c, 'final-challenge.coveredDays', /covers the whole challenge/);
    });
  });

  describe('exercises', () => {
    it('rejects a choice whose answer is not among its options', () => {
      const c = course();
      const exercise = c.grammar[0]?.exercises[0];
      if (!exercise) throw new Error('no grammar exercise');
      exercise.correctOptionId = 'z';
      expectError(
        c,
        'grammar-present-simple-habits.exercises[0]',
        /correctOptionId is not one of the options/,
      );
    });

    it('rejects an empty vocabulary quest', () => {
      const c = course();
      lesson(c, 'd001-vocabulary', 'vocabulary').wordIds = [];
      expect(errorsOf(c).map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['d001-vocabulary.wordIds']),
      );
    });

    it('rejects a quest that promises more words than it teaches', () => {
      const c = course();
      const quest = lesson(c, 'd001-vocabulary', 'vocabulary');
      quest.wordIds = quest.wordIds.slice(0, 5);
      quest.exercises = quest.exercises.filter((exercise) =>
        [exercise.itemId, ...exercise.optionItemIds].every((id) => quest.wordIds.includes(id)),
      );
      expectError(c, 'd001-vocabulary.wordIds', /promises 6 new words, the quest teaches 5/);
    });
  });

  it('never throws, whatever it is given', () => {
    for (const input of [null, 42, 'course', {}, { days: 'no' }]) {
      const result = validateCourse(input);
      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});
