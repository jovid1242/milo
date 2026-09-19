import type {
  DayNumber,
  ExamAnswer,
  ExamSection,
  QuestCompletion,
  Exam,
  ExamAttempt,
  ExamQuestion,
  ExamScore,
} from '@/schemas';

/**
 * The rules of an exam — the weekly exam and the Final Battle alike — in one
 * place: answers stay open until the whole exam is submitted, scoring happens
 * here (never in a screen), and the pass line comes from the exam itself.
 */

export function answerFor(answers: readonly ExamAnswer[], questionId: string): string | null {
  return answers.find((answer) => answer.questionId === questionId)?.optionId ?? null;
}

/**
 * Chooses (or changes) an answer. A submitted attempt is final: it comes back
 * unchanged, as does an option the question does not have.
 */
export function withExamAnswer(
  attempt: ExamAttempt,
  question: ExamQuestion,
  optionId: string,
  at: string,
): ExamAttempt {
  if (attempt.submittedAt !== null) return attempt;
  if (!question.options.some((option) => option.id === optionId)) return attempt;
  const answers = [
    ...attempt.answers.filter((answer) => answer.questionId !== question.id),
    { questionId: question.id, optionId },
  ];
  return { ...attempt, answers, updatedAt: at };
}

/** Moves to another question of an open attempt (Previous / Next). */
export function withPosition(
  attempt: ExamAttempt,
  index: number,
  exam: Exam,
  at: string,
): ExamAttempt {
  if (attempt.submittedAt !== null) return attempt;
  const currentIndex = Math.min(Math.max(0, index), exam.questions.length - 1);
  return currentIndex === attempt.currentIndex
    ? attempt
    : { ...attempt, currentIndex, updatedAt: at };
}

export function unansweredQuestions(exam: Exam, answers: readonly ExamAnswer[]): ExamQuestion[] {
  return exam.questions.filter((question) => answerFor(answers, question.id) === null);
}

/** Share of the exam answered — what Home shows while it is in progress. */
export function examProgress(exam: Exam, answers: readonly ExamAnswer[]): number {
  return (
    (exam.questions.length - unansweredQuestions(exam, answers).length) / exam.questions.length
  );
}

/** A tiny tolerance, so 7 of 10 is exactly 70% however floats round it. */
const EPSILON = 1e-9;

/** Scores answers against the exam: unanswered counts as not right. */
export function scoreExam(exam: Exam, answers: readonly ExamAnswer[]): ExamScore {
  const totalCount = exam.questions.length;
  const correctCount = exam.questions.filter(
    (question) => answerFor(answers, question.id) === question.correctOptionId,
  ).length;
  const score = correctCount / totalCount;
  return {
    correctCount,
    totalCount,
    unansweredCount: unansweredQuestions(exam, answers).length,
    score,
    passed: score + EPSILON >= exam.passingScore,
    isPerfect: correctCount === totalCount,
  };
}

/** Right answers needed to pass, e.g. 11 of 15 at 70%. */
export function passMark(exam: Exam): number {
  return Math.ceil(exam.passingScore * exam.questions.length - EPSILON);
}

/** Right answers per section, in the exam's order — where the tricky parts were. */
export function sectionScores(exam: Exam, answers: readonly ExamAnswer[]) {
  const sections: { section: ExamSection; correct: number; total: number }[] = [];
  for (const question of exam.questions) {
    let entry = sections.find((item) => item.section === question.section);
    if (!entry) {
      entry = { section: question.section, correct: 0, total: 0 };
      sections.push(entry);
    }
    entry.total += 1;
    if (answerFor(answers, question.id) === question.correctOptionId) entry.correct += 1;
  }
  return sections;
}

/** The best submitted attempt (the latest of equals): what a reopened exam shows. */
export function bestAttempt(attempts: readonly ExamAttempt[]): ExamAttempt | null {
  let best: ExamAttempt | null = null;
  for (const attempt of attempts) {
    if (attempt.submittedAt === null) continue;
    if (!best || (attempt.correctCount ?? 0) >= (best.correctCount ?? 0)) best = attempt;
  }
  return best;
}

/** Each question with the user's answer and the right one — for the review after submission. */
export function reviewExam(exam: Exam, answers: readonly ExamAnswer[]) {
  return exam.questions.map((question, index) => {
    const given = answerFor(answers, question.id);
    return {
      number: index + 1,
      question,
      given,
      correct: given === question.correctOptionId,
    };
  });
}

/**
 * Saved attempts are untrusted (content may change between versions): answers
 * to unknown questions or options are dropped and the position is kept in range.
 */
export function restoreAttempt(exam: Exam, attempt: ExamAttempt): ExamAttempt {
  const answers = attempt.answers.filter((answer) =>
    exam.questions.some(
      (question) =>
        question.id === answer.questionId &&
        question.options.some((option) => option.id === answer.optionId),
    ),
  );
  const currentIndex = Math.min(attempt.currentIndex, exam.questions.length - 1);
  return { ...attempt, answers, currentIndex };
}

/**
 * The exam as a milestone on the map and on Home:
 * - `locked`: its day has not come, or the day's warm-up is not done yet
 * - `available` / `inProgress`: it can be started / resumed
 * - `passed` / `notPassed`: submitted (a retake is always possible)
 * - `missed`: its day passed without it — days are never played late
 */
export type ExamStatus = 'locked' | 'available' | 'inProgress' | 'passed' | 'notPassed' | 'missed';

export function examStatus(input: {
  examDay: DayNumber;
  currentDay: DayNumber;
  /** The quests before the exam on its day are done. */
  warmUpDone: boolean;
  passingScore: number;
  attempts: readonly ExamAttempt[];
  /** The exam quest's completion (seeded history may have one without attempts). */
  completion: QuestCompletion | null;
}): ExamStatus {
  const submitted = input.attempts.filter((attempt) => attempt.submittedAt !== null);
  if (submitted.some((attempt) => attempt.passed)) return 'passed';
  if (input.attempts.some((attempt) => attempt.submittedAt === null)) return 'inProgress';
  if (submitted.length > 0) return 'notPassed';
  if (input.completion) {
    return input.completion.score + EPSILON >= input.passingScore ? 'passed' : 'notPassed';
  }
  if (input.currentDay < input.examDay) return 'locked';
  if (input.currentDay > input.examDay) return 'missed';
  return input.warmUpDone ? 'available' : 'locked';
}
