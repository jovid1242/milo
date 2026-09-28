import { LOCAL_COURSE } from '@/content/course';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { finishQuestRun, loadQuestRun } from '@/features/quests/use-cases';
import { resolveReview } from '@/features/review/logic/review-items';
import { QuestContentSchema, type ChoiceAnswer } from '@/schemas';

import { LocalCourseRepository } from '../local-course-repository';

const AT = '2026-09-18T10:00:00.000Z';
const repository = new LocalCourseRepository();

describe('LocalCourseRepository', () => {
  it('serves the outline: which course, which version — without the content banks', async () => {
    const outline = await repository.getCourse();
    expect(outline).toMatchObject({
      id: 'milo-english-90',
      version: 1,
      language: 'en',
      supportLanguage: 'ru',
      totalDays: 90,
    });
    expect(outline.chapters.map((chapter) => chapter.id)).toEqual([
      'beginning',
      'momentum',
      'habit',
      'growth',
      'summit',
    ]);
    expect(outline.days).toHaveLength(90);
    expect(Object.keys(outline)).not.toEqual(expect.arrayContaining(['vocabulary', 'lessons']));
    expect(await repository.getChapters()).toBe(outline.chapters);
    expect(await repository.getDays()).toBe(outline.days);
  });

  it('serves days by number, with stable ids and their kind from the course', async () => {
    const day1 = await repository.getDay(1);
    expect(day1).toMatchObject({ id: 'd001', week: 1, chapterId: 'beginning', kind: 'regular' });
    expect(day1.quests.map((quest) => quest.id)).toEqual([
      'd001-vocabulary',
      'd001-grammar',
      'd001-reading',
      'd001-review',
    ]);
    expect(await repository.getDay(7)).toMatchObject({ kind: 'weeklyExam', week: 1 });
    expect((await repository.getDay(90)).quests.map((quest) => quest.id)).toEqual([
      'd090-finalBattle',
    ]);
    await expect(repository.getDay(91)).rejects.toThrow('No course day 91');
  });

  it('resolves Day 1 into content the game can play, by course-wide ids', async () => {
    const [vocabulary, grammar, reading, review] = await Promise.all(
      ['vocabulary', 'grammar', 'reading', 'review'].map((type) =>
        repository.getQuestContent(`d001-${type}`),
      ),
    );
    for (const content of [vocabulary, grammar, reading, review]) {
      expect(QuestContentSchema.safeParse(content).success).toBe(true);
    }
    if (vocabulary?.type !== 'vocabulary') throw new Error('Day 1 has words');
    expect(vocabulary.items.map((item) => item.id)).toEqual([
      'vocab-journey',
      'vocab-habit',
      'vocab-goal',
      'vocab-improve',
      'vocab-practice',
      'vocab-confident',
    ]);
    expect(grammar).toMatchObject({ lessonId: 'grammar-present-simple-habits' });
    expect(reading).toMatchObject({ readingId: 'reading-milo-packs-his-backpack' });
    if (review?.type !== 'review') throw new Error('Day 1 has a review');
    expect(resolveReview(review)).toHaveLength(review.exercises.length);
  });

  it('resolves each quest once', async () => {
    const first = await repository.getQuestContent('d002-reading');
    expect(await repository.getQuestContent('d002-reading')).toBe(first);
  });

  it('has no content yet for days not written — and says so with null', async () => {
    expect(await repository.getQuestContent('d003-vocabulary')).toBeNull();
    expect(await repository.getWeeklyExam(14)).toBeNull();
    expect(await repository.getWeeklyExam(1)).toBeNull();
  });

  it('serves the weekly exams and the Final Battle from the course', async () => {
    expect(await repository.getWeeklyExam(7)).toMatchObject({
      id: 'exam-week-01',
      questId: 'd007-weeklyExam',
      week: 1,
      coveredDays: [1, 2],
    });
    expect(await repository.getWeeklyExam(84)).toMatchObject({ id: 'exam-week-12', week: 12 });
    expect(await repository.getQuestContent('d007-weeklyExam')).toMatchObject({
      id: 'exam-week-01',
    });
    expect(await repository.getFinalChallenge()).toMatchObject({
      id: 'final-challenge',
      questId: 'd090-finalBattle',
      day: 90,
    });
  });

  it('never serves an invalid course — and says where it is wrong', async () => {
    const broken = structuredClone(LOCAL_COURSE);
    const day15 = broken.days[14];
    if (!day15) throw new Error('no day 15');
    day15.chapterId = 'beginning';
    const invalid = new LocalCourseRepository(broken);

    await expect(invalid.getCourse()).rejects.toThrow(
      /^The course is invalid:\nERROR d015\.chapterId: day 15 is in chapter "momentum"/,
    );
    await expect(invalid.getQuestContent('d001-vocabulary')).rejects.toThrow(
      'The course is invalid',
    );
  });
});

describe('Day 1 through the game', () => {
  const answersFor = (ids: readonly string[]): ChoiceAnswer[] =>
    ids.map((exerciseId) => ({ exerciseId, optionId: 'x', correct: true, answeredAt: AT }));

  it('records learned words by their course ids, and the course version it was earned on', async () => {
    const repositories = createMemoryRepositories(getStartDateForDay(1, new Date()));
    const run = await loadQuestRun(repositories, 'd001-vocabulary');
    if (run.content?.type !== 'vocabulary') throw new Error('Day 1 has words');
    const exercises = run.content.exercises.map((exercise) => exercise.id);

    const outcome = await finishQuestRun(repositories, {
      questId: 'd001-vocabulary',
      answers: answersFor(exercises),
      exerciseCount: exercises.length,
    });

    // 20 XP, and +10 for a perfect run.
    expect(outcome).toMatchObject({ isFirstCompletion: true, xpEarned: 30 });
    expect([...repositories.store.words.values()].map((word) => word.wordId).sort()).toEqual([
      'vocab-confident',
      'vocab-goal',
      'vocab-habit',
      'vocab-improve',
      'vocab-journey',
      'vocab-practice',
    ]);
    expect(repositories.store.completions.get('d001-vocabulary')).toMatchObject({
      courseVersion: 1,
      day: 1,
    });
    expect(await repositories.progress.countLearnedWords()).toBe(6);
  });

  it('counts a word once, whichever quest shows it again', async () => {
    const repositories = createMemoryRepositories(getStartDateForDay(1, new Date()));
    await repositories.progress.recordLearnedWords([
      { wordId: 'vocab-habit', questId: 'd001-vocabulary', learnedAt: AT },
      { wordId: 'vocab-habit', questId: 'd002-review', learnedAt: AT },
    ]);
    expect(await repositories.progress.countLearnedWords()).toBe(1);
  });
});
