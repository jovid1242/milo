import { LOCAL_COURSE } from '@/content/course';
import type { Course } from '@/schemas';

import { curriculumStats, validateCurriculum } from '../logic/curriculum';
import type { CourseIssue } from '../logic/validate';

/** A fresh, mutable copy of the bundled course to break on purpose. */
const course = (): Course => structuredClone(LOCAL_COURSE);

const errorsOf = (input: Course): CourseIssue[] =>
  validateCurriculum(input).filter((issue) => issue.severity === 'error');

const expectError = (input: Course, path: string, message: RegExp) => {
  expect(errorsOf(input)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path, message: expect.stringMatching(message) }),
    ]),
  );
};

function planOf(input: Course, day: number) {
  const plan = input.days[day - 1]?.curriculum;
  if (!plan) throw new Error(`d${day} has no curriculum`);
  return plan;
}
function lesson(input: Course, day: number) {
  const plan = planOf(input, day);
  if (plan.kind !== 'regular') throw new Error(`d${day} is not a lesson day`);
  return plan;
}
function checkpoint(input: Course, day: number) {
  const plan = planOf(input, day);
  if (plan.kind !== 'weeklyExam') throw new Error(`d${day} is not a checkpoint`);
  return plan;
}
function summit(input: Course) {
  const plan = planOf(input, 90);
  if (plan.kind !== 'summit') throw new Error('d90 is not the summit');
  return plan;
}

describe('the bundled curriculum', () => {
  it('passes, warning only about written content that predates it', () => {
    const issues = validateCurriculum(LOCAL_COURSE);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(issues.map((issue) => issue.path)).toEqual([
      'exam-week-01.coveredDays',
      'final-challenge.questions',
    ]);
  });

  it('gives every day objectives of its own kind, read from the course plan', () => {
    expect(LOCAL_COURSE.days.map((day) => day.curriculum?.kind)).toEqual(
      LOCAL_COURSE.days.map((day) => day.kind),
    );
  });

  it('never gets easier: chapter bands and day levels', () => {
    expect(LOCAL_COURSE.chapters.map((chapter) => chapter.band)).toEqual([
      'A2',
      'A2+',
      'B1-',
      'B1',
      'B1',
    ]);
    expect(LOCAL_COURSE.days[9]?.level).toBe('A2');
    expect(LOCAL_COURSE.days[30]?.level).toBe('B1');
  });

  it('adds up: 534 new words, 32 topics over 77 lessons, every genre', () => {
    const stats = curriculumStats(LOCAL_COURSE);
    expect(stats.newWords).toBe(534);
    expect(stats.chapters.map((chapter) => chapter.newWords)).toEqual([60, 120, 180, 174, 0]);
    expect(stats.grammar).toMatchObject({ topics: 32, lessons: 77 });
    expect(stats.grammar.stages.introduce).toBe(32);
    expect(Object.values(stats.genres).reduce((sum, count) => sum + count, 0)).toBe(77);
    expect(Math.min(...Object.values(stats.genres))).toBeGreaterThanOrEqual(3);
    expect(stats.grammar.revisits.min).toBeGreaterThanOrEqual(1);
  });

  it('flags the written content that no longer fits', () => {
    expect(curriculumStats(LOCAL_COURSE).revisions.map((revision) => revision.day)).toEqual([
      7, 84, 89, 90,
    ]);
  });

  it('plans reviews by spaced repetition: today, about 2 and 7 days back, then 3 weeks', () => {
    expect(lesson(LOCAL_COURSE, 1).review).toMatchObject({ today: 6, recentDays: [] });
    // Day 2 has no day two before it: yesterday is its recent past.
    expect(lesson(LOCAL_COURSE, 2).review).toMatchObject({ today: 4, recent: 2, recentDays: [1] });
    expect(lesson(LOCAL_COURSE, 15).review).toMatchObject({
      recentDays: [13, 8],
      olderDays: [1],
      today: 4,
      recent: 2,
      older: 2,
    });
    expect(lesson(LOCAL_COURSE, 89).review).toMatchObject({
      recentDays: [87, 82],
      olderDays: [68],
    });
  });

  it('builds each exam from the week it covers', () => {
    const week1 = checkpoint(LOCAL_COURSE, 7).exam;
    expect(week1.coveredDays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(week1.grammar).toEqual(['present-simple', 'adverbs-of-frequency', 'present-continuous']);
    expect(week1).toMatchObject({ questions: 9 });
    expect(checkpoint(LOCAL_COURSE, 14).exam).toMatchObject({ questions: 12 });
    expect(checkpoint(LOCAL_COURSE, 84).exam).toMatchObject({
      coveredDays: [78, 79, 80, 81, 82, 83],
      questions: 15,
    });
  });
});

describe('validateCurriculum', () => {
  it('requires objectives for every day', () => {
    const c = course();
    const day = c.days[44];
    if (!day) throw new Error('no day 45');
    delete day.curriculum;
    expectError(c, 'd045', /no curriculum/);
  });

  it('reads checkpoints from the plan, never from the day number', () => {
    const c = course();
    const day = c.days[7];
    if (!day) throw new Error('no day 8');
    day.kind = 'weeklyExam';
    expectError(c, 'd008.curriculum.kind', /makes d008 weeklyExam, not regular/);
    // Day 14's exam now only covers the days since Day 8.
    expectError(c, 'd014.curriculum.exam.coveredDays', /d009, d010, d011, d012, d013/);
  });

  describe('grammar', () => {
    it('introduces a topic only after its prerequisites', () => {
      const c = course();
      lesson(c, 43).grammar.topic = 'first-conditional';
      expectError(c, 'd043.curriculum.grammar', /before its prerequisite "zero-conditional"/);
      expectError(c, 'd044.curriculum.grammar', /introduced again \(first on d043\)/);
    });

    it('never practises a topic before introducing it', () => {
      const c = course();
      lesson(c, 12).grammar.topic = 'present-perfect';
      expectError(c, 'd012.curriculum.grammar', /worked on \(practice\) before it is introduced/);
    });

    it('recycles only topics taught on earlier days', () => {
      const c = course();
      lesson(c, 6).grammar.related.push('past-simple');
      expectError(c, 'd006.curriculum.grammar', /related "past-simple" is not introduced before/);
    });

    it('needs something to contrast with', () => {
      const c = course();
      lesson(c, 6).grammar.related = [];
      expectError(c, 'd006.curriculum.grammar', /a contrast needs something to contrast with/);
    });

    it('keeps topics to their day’s level', () => {
      const c = course();
      lesson(c, 8).grammar.topic = 'relative-clauses';
      expectError(c, 'd008.curriculum.grammar.topic', /B1 topic "relative-clauses" on a A2 day/);
    });

    it('warns about a topic no day introduces', () => {
      const c = course();
      c.curriculum.grammarTopics.push({
        id: 'third-conditional',
        title: 'Third conditional',
        level: 'B2',
        prerequisites: ['second-conditional'],
      });
      expect(validateCurriculum(c)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'warning',
            path: 'curriculum.grammarTopics[third-conditional]',
          }),
        ]),
      );
    });
  });

  describe('themes and words', () => {
    it('changes theme family from one lesson day to the next', () => {
      const c = course();
      lesson(c, 9).theme.family = 'city';
      expectError(c, 'd009.curriculum.theme.family', /"city" again right after d008/);
    });

    it('gives each day its own theme title', () => {
      const c = course();
      lesson(c, 9).theme.title = 'Around town';
      expectError(c, 'd009.curriculum.theme.title', /already the theme of d008/);
    });

    it('plans each anchor word once, never a word another day teaches', () => {
      const c = course();
      lesson(c, 3).vocabulary.examples = ['library', 'journey (a long trip)'];
      // Reported where it repeats: Day 8 plans "library" after Day 3 now does.
      expectError(
        c,
        'd008.curriculum.vocabulary.examples[0]',
        /"library" is already planned for d003/,
      );
      expectError(c, 'd003.curriculum.vocabulary.examples[1]', /already taught on d001/);
    });
  });

  describe('reviews', () => {
    it('adds up to the band’s review size', () => {
      const c = course();
      lesson(c, 20).review.today = 6;
      expectError(c, 'd020.curriculum.review', /10 exercises; a A2\+ review has 8/);
    });

    it('comes back only to earlier days with material', () => {
      const c = course();
      lesson(c, 20).review.recentDays = [22];
      expectError(c, 'd020.curriculum.review', /d022 is not an earlier day with material/);
    });
  });

  describe('checkpoints and the summit', () => {
    it('covers exactly the days since the last checkpoint', () => {
      const c = course();
      checkpoint(c, 21).exam.coveredDays = [15, 16, 17];
      expectError(c, 'd021.curriculum.exam.coveredDays', /the days since the last checkpoint/);
    });

    it('splits its questions over the sections', () => {
      const c = course();
      checkpoint(c, 21).exam.sections.reading = 5;
      expectError(c, 'd021.curriculum.exam.sections', /add up to 14, not 12/);
    });

    it('keeps the Final Battle blueprint consistent', () => {
      const c = course();
      const { final } = summit(c);
      final.measures.vocabularyRetention = 8;
      final.chapters.push({ chapterId: 'summit', questions: 0 });
      final.grammarStrands.pop();
      expectError(c, 'd090.curriculum.final.measures', /adds up to 22, not 20/);
      expectError(c, 'd090.curriculum.final.chapters', /"summit" is not a chapter before/);
      expectError(c, 'd090.curriculum.final.grammarStrands', /5 strands for 6 grammar questions/);
    });
  });

  describe('difficulty and outcomes', () => {
    it('never lets the curve go down', () => {
      const c = course();
      const growth = c.chapters.find((chapter) => chapter.id === 'growth');
      if (!growth) throw new Error('no growth chapter');
      growth.band = 'A2+';
      expectError(
        c,
        'chapters[growth].band',
        /A2\+ after B1-: the difficulty curve never goes down/,
      );
      expectError(c, 'd061.level', /B1 does not match its chapter's band A2\+ \(A2\)/);
    });

    it('states an outcome at the end of every chapter', () => {
      const c = course();
      c.curriculum.outcomes = c.curriculum.outcomes.filter((outcome) => outcome.day !== 30);
      expectError(c, 'chapters[momentum]', /no learning outcome for d030/);
    });
  });
});
