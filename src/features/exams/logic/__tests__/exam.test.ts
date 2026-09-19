import { WEEK_12_EXAM } from '@/data/content/exams/week-12';
import { WeeklyExamSchema, type WeeklyExam, type ExamAttempt } from '@/schemas';

import {
  examStatus,
  restoreAttempt,
  reviewExam,
  scoreExam,
  unansweredQuestions,
  withExamAnswer,
  withPosition,
} from '../exam';

const EXAM: WeeklyExam = WeeklyExamSchema.parse(WEEK_12_EXAM);
const AT = '2026-09-18T10:00:00.000Z';

/** Answers every question: right, except the ones at `wrongAt`; `skip` stays unanswered. */
function answers(exam: WeeklyExam, { wrongAt = [] as number[], skip = [] as number[] } = {}) {
  return exam.questions.flatMap((question, index) => {
    if (skip.includes(index)) return [];
    const wrong = question.options.find((option) => option.id !== question.correctOptionId);
    return [
      {
        questionId: question.id,
        optionId: wrongAt.includes(index) ? (wrong?.id ?? '') : question.correctOptionId,
      },
    ];
  });
}

const attempt = (patch: Partial<ExamAttempt> = {}): ExamAttempt => ({
  id: 'attempt-1',
  examId: EXAM.id,
  questId: EXAM.questId,
  number: 1,
  startedAt: AT,
  updatedAt: AT,
  currentIndex: 0,
  answers: [],
  submittedAt: null,
  correctCount: null,
  totalCount: EXAM.questions.length,
  score: null,
  passed: null,
  ...patch,
});

/** A synthetic exam with `count` questions and a 70% pass line. */
function syntheticExam(count: number): WeeklyExam {
  return {
    ...EXAM,
    questions: Array.from({ length: count }, (_, index) => ({
      id: `q${index}`,
      section: 'grammar' as const,
      sourceDay: 80,
      prompt: `Question ${index}`,
      options: [
        { id: 'a', text: 'right' },
        { id: 'b', text: 'wrong' },
      ],
      correctOptionId: 'a',
      explanation: 'Because.',
    })),
  };
}

describe('the Week 12 exam', () => {
  it('has 15 questions from the week before: 6 vocabulary, 5 grammar, 4 reading', () => {
    expect(EXAM.questions).toHaveLength(15);
    const count = (section: string) => EXAM.questions.filter((q) => q.section === section).length;
    expect([count('vocabulary'), count('grammar'), count('reading')]).toEqual([6, 5, 4]);
    expect(EXAM.coveredDays).toEqual([78, 79, 80, 81, 82, 83]);
    expect(EXAM.passingScore).toBe(0.7);
    expect(EXAM.xpReward).toBe(100);
  });
});

describe('scoring', () => {
  it('scores 15 questions', () => {
    expect(scoreExam(EXAM, answers(EXAM, { wrongAt: [0, 5, 9] }))).toEqual({
      correctCount: 12,
      totalCount: 15,
      unansweredCount: 0,
      score: 12 / 15,
      passed: true,
      isPerfect: false,
    });
    expect(scoreExam(EXAM, answers(EXAM)).isPerfect).toBe(true);
  });

  it('passes at 70% and not at 69%', () => {
    const ten = syntheticExam(10);
    const right = (exam: WeeklyExam, n: number) =>
      exam.questions.map((question, index) => ({
        questionId: question.id,
        optionId: index < n ? 'a' : 'b',
      }));
    expect(scoreExam(ten, right(ten, 7))).toMatchObject({ score: 0.7, passed: true });
    const thirteen = syntheticExam(13);
    expect(scoreExam(thirteen, right(thirteen, 9)).passed).toBe(false); // 69.2%
    expect(scoreExam(ten, right(ten, 6)).passed).toBe(false);
  });

  it('counts unanswered questions as not right', () => {
    const result = scoreExam(EXAM, answers(EXAM, { skip: [3, 4] }));
    expect(result).toMatchObject({ correctCount: 13, unansweredCount: 2 });
    expect(unansweredQuestions(EXAM, answers(EXAM, { skip: [3, 4] })).map((q) => q.id)).toEqual([
      'w12-v4',
      'w12-v5',
    ]);
  });
});

describe('answers', () => {
  const first = EXAM.questions[0];
  if (!first) throw new Error('no question');

  it('can change until the exam is submitted', () => {
    const picked = withExamAnswer(attempt(), first, 'a', AT);
    const changed = withExamAnswer(picked, first, 'b', AT);
    expect(changed.answers).toEqual([{ questionId: first.id, optionId: 'b' }]);
    // An option the question does not have changes nothing.
    expect(withExamAnswer(changed, first, 'zz', AT)).toBe(changed);
  });

  it('are final once submitted', () => {
    const submitted = attempt({
      answers: [{ questionId: first.id, optionId: 'b' }],
      submittedAt: AT,
    });
    expect(withExamAnswer(submitted, first, 'a', AT)).toBe(submitted);
    expect(withPosition(submitted, 5, EXAM, AT)).toBe(submitted);
  });

  it('are restored from a saved attempt, dropping what no longer fits', () => {
    const saved = attempt({
      currentIndex: 42,
      answers: [
        { questionId: first.id, optionId: 'b' },
        { questionId: 'gone', optionId: 'a' },
        { questionId: 'w12-v2', optionId: 'zz' },
      ],
    });
    const restored = restoreAttempt(EXAM, saved);
    expect(restored.answers).toEqual([{ questionId: first.id, optionId: 'b' }]);
    expect(restored.currentIndex).toBe(14);
  });

  it('are reviewed with the right answer after submission', () => {
    const review = reviewExam(EXAM, answers(EXAM, { wrongAt: [1], skip: [2] }));
    expect(review[0]).toMatchObject({ number: 1, correct: true });
    expect(review[1]).toMatchObject({ correct: false });
    expect(review[2]).toMatchObject({ given: null, correct: false });
  });
});

describe('exam status', () => {
  const base = {
    examDay: 84,
    currentDay: 84,
    warmUpDone: true,
    passingScore: 0.7,
    attempts: [] as ExamAttempt[],
    completion: null,
  };
  it('follows the day, the warm-up and the attempts', () => {
    expect(examStatus({ ...base, currentDay: 83 })).toBe('locked');
    expect(examStatus({ ...base, warmUpDone: false })).toBe('locked');
    expect(examStatus(base)).toBe('available');
    expect(examStatus({ ...base, attempts: [attempt()] })).toBe('inProgress');
    const failed = attempt({ submittedAt: AT, score: 0.6, passed: false, correctCount: 9 });
    expect(examStatus({ ...base, attempts: [failed] })).toBe('notPassed');
    const passed = attempt({ id: 'a2', number: 2, submittedAt: AT, score: 0.8, passed: true });
    expect(examStatus({ ...base, attempts: [failed, passed] })).toBe('passed');
    expect(examStatus({ ...base, currentDay: 85 })).toBe('missed');
  });
});

describe('content validation', () => {
  const invalid = (patch: (exam: WeeklyExam) => unknown) =>
    WeeklyExamSchema.safeParse(patch(structuredClone(EXAM) as WeeklyExam)).success;

  it('rejects malformed exams', () => {
    expect(invalid((exam) => exam)).toBe(true);
    expect(
      invalid((exam) => ({
        ...exam,
        questions: exam.questions.map((q, i) => (i === 0 ? { ...q, correctOptionId: 'zz' } : q)),
      })),
    ).toBe(false);
    expect(
      invalid((exam) => ({ ...exam, questions: [exam.questions[0], ...exam.questions] })),
    ).toBe(false);
    expect(
      invalid((exam) => ({
        ...exam,
        questions: exam.questions.map((q, i) => (i === 0 ? { ...q, sourceDay: 60 } : q)),
      })),
    ).toBe(false);
    expect(
      invalid((exam) => ({
        ...exam,
        questions: exam.questions.map((q) =>
          q.section === 'reading' ? { ...q, passageId: undefined } : q,
        ),
      })),
    ).toBe(false);
    expect(invalid((exam) => ({ ...exam, coveredDays: [84] }))).toBe(false);
    expect(invalid((exam) => ({ ...exam, passingScore: 1.5 }))).toBe(false);
  });
});
