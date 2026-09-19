import type { Repositories } from '@/data/repositories/types';
import { syncAchievements } from '@/features/achievements/use-cases';
import { getChallengeDay } from '@/features/challenge/logic/calendar';
import { buildDayCompletion, findCompletedDays } from '@/features/progress/logic/day-completion';
import type { DayCompletionResult } from '@/features/progress/use-cases';
import type {
  Achievement,
  AnswerRecord,
  ChallengeCompletion,
  DailyChallenge,
  DayNumber,
  Exam,
  ExamAttempt,
  ExamScore,
  Quest,
  QuestCompletion,
  Timestamp,
} from '@/schemas';

import {
  answerFor,
  bestAttempt,
  examProgress,
  examStatus,
  restoreAttempt,
  scoreExam,
  type ExamStatus,
} from './logic/exam';

/**
 * Everything an exam screen needs — a weekly exam or the Final Battle: the
 * exam, its attempts and where it stands.
 */
export type ExamRun = {
  quest: Quest;
  /** `null` while the exam is not written yet. */
  exam: Exam | null;
  attempts: ExamAttempt[];
  /** The attempt to resume, if one is open. */
  open: ExamAttempt | null;
  /** The best submitted attempt — its result is shown when the exam is reopened. */
  best: ExamAttempt | null;
  status: ExamStatus;
  /** Today in the challenge — a locked exam says when it opens. */
  currentDay: DayNumber;
  /** The pass reward was paid already (a retake cannot earn it again). */
  rewardPaid: boolean;
  isLastOfDay: boolean;
};

/** The quests that are exams: the week's checkpoint and the Final Battle. */
const isExamQuest = (quest: Quest) => quest.type === 'weeklyExam' || quest.type === 'finalBattle';

const isExam = (content: unknown): content is Exam =>
  typeof content === 'object' &&
  content !== null &&
  'type' in content &&
  (content.type === 'weeklyExam' || content.type === 'finalBattle');

async function findExamQuest(repositories: Repositories, questId: string) {
  const plans = await repositories.challenge.getDailyChallenges();
  const plan = plans.find((item) => item.quests.some((quest) => quest.id === questId));
  const quest = plan?.quests.find((item) => item.id === questId);
  if (!plan || !quest || !isExamQuest(quest)) throw new Error(`Not an exam: ${questId}`);
  return { plan, quest };
}

export async function loadExamRun(
  repositories: Repositories,
  questId: string,
  now: Date = new Date(),
): Promise<ExamRun> {
  const [{ plan, quest }, content, user, completions] = await Promise.all([
    findExamQuest(repositories, questId),
    repositories.challenge.getQuestContent(questId),
    repositories.user.getUser(),
    repositories.progress.getCompletions(),
  ]);
  const exam = isExam(content) ? content : null;
  const attempts = exam
    ? (await repositories.exams.getAttempts(exam.id)).map((attempt) =>
        restoreAttempt(exam, attempt),
      )
    : [];
  const done = new Set(completions.map((completion) => completion.questId));
  const currentDay = getChallengeDay(user.challengeStartDate, now);
  const status = examStatus({
    examDay: quest.day,
    currentDay,
    warmUpDone: plan.quests.slice(0, plan.quests.indexOf(quest)).every((item) => done.has(item.id)),
    passingScore: exam?.passingScore ?? 0.7,
    attempts,
    completion: completions.find((completion) => completion.questId === questId) ?? null,
  });
  return {
    quest,
    exam,
    attempts,
    open: attempts.find((attempt) => attempt.submittedAt === null) ?? null,
    best: bestAttempt(attempts),
    status,
    currentDay,
    // Paid in the same write as the first passing submission.
    rewardPaid: status === 'passed',
    isLastOfDay: plan.quests.at(-1)?.id === questId,
  };
}

async function examOf(repositories: Repositories, questId: string): Promise<Exam> {
  const content = await repositories.challenge.getQuestContent(questId);
  if (!isExam(content)) throw new Error(`No exam content for ${questId}`);
  return content;
}

/**
 * Opens a new attempt — or the open one, which is resumed instead: there is
 * never more than one attempt in progress. The first try also shows on Home
 * as "in progress".
 */
export async function startExamAttempt(
  repositories: Repositories,
  questId: string,
  now: Date = new Date(),
): Promise<ExamAttempt> {
  const exam = await examOf(repositories, questId);
  const attempts = await repositories.exams.getAttempts(exam.id);
  const timestamp = now.toISOString();
  const attempt = await repositories.exams.openAttempt({
    id: `${exam.id}-${attempts.length + 1}-${now.getTime().toString(36)}`,
    examId: exam.id,
    questId,
    number: attempts.length + 1,
    startedAt: timestamp,
    updatedAt: timestamp,
    currentIndex: 0,
    answers: [],
    submittedAt: null,
    correctCount: null,
    totalCount: exam.questions.length,
    score: null,
    passed: null,
  });
  await trackOnHome(repositories, exam, attempt, timestamp);
  return restoreAttempt(exam, attempt);
}

/** While the exam quest is not finished, Home shows the open attempt as in progress. */
async function trackOnHome(
  repositories: Repositories,
  exam: Exam,
  attempt: ExamAttempt,
  timestamp: string,
) {
  const completions = await repositories.progress.getCompletions();
  if (completions.some((completion) => completion.questId === attempt.questId)) return;
  await repositories.progress.saveQuestSession({
    questId: attempt.questId,
    startedAt: attempt.startedAt,
    updatedAt: timestamp,
    progress: examProgress(exam, attempt.answers),
    state: null,
  });
}

/** Saves answers and position of an open attempt (a submitted one is final). */
export async function saveExamAttempt(
  repositories: Repositories,
  attempt: ExamAttempt,
): Promise<void> {
  const saved = await repositories.exams.saveAttempt(attempt);
  if (!saved) return;
  const exam = await examOf(repositories, attempt.questId);
  await trackOnHome(repositories, exam, attempt, attempt.updatedAt);
}

export type ExamSubmission = {
  attempt: ExamAttempt;
  result: ExamScore;
  /** This call submitted it (a repeated submit changes nothing). */
  isFirstSubmission: boolean;
  /** The pass reward was paid now — only ever for the first pass. */
  rewardGranted: boolean;
  xpEarned: number;
  /** This submission finished the exam's day. */
  dayCompleted: boolean;
  day: DayCompletionResult | null;
  /** The Final Battle's first pass: the summit — the whole challenge — is reached. */
  challengeCompleted: boolean;
  newAchievements: Achievement[];
};

const toAnswerRecords = (exam: Exam, attempt: ExamAttempt, at: string): AnswerRecord[] =>
  exam.questions.flatMap((question) => {
    const optionId = answerFor(attempt.answers, question.id);
    return optionId === null
      ? []
      : [
          {
            questId: attempt.questId,
            questionId: question.id,
            answer: { kind: 'singleChoice' as const, optionId },
            isCorrect: optionId === question.correctOptionId,
            answeredAt: at,
          },
        ];
  });

/** The record of the day a completion would finish — `null` while other quests are open. */
async function dayRecordWith(
  repositories: Repositories,
  plan: DailyChallenge,
  completion: QuestCompletion,
  completedAt: Timestamp,
) {
  const [plans, completions] = await Promise.all([
    repositories.challenge.getDailyChallenges(),
    repositories.progress.getCompletions(),
  ]);
  const all = [...completions.filter((item) => item.questId !== completion.questId), completion];
  return buildDayCompletion({
    plan,
    completions: all,
    completedDays: findCompletedDays(plans, all),
    completedAt,
  });
}

/**
 * Submits an attempt and settles everything once:
 * - scores it (unanswered counts as not right) — here, never in a screen;
 * - pays the pass reward the first time the exam is passed (retakes cannot farm it);
 * - a weekly exam is finished by handing it in, the Final Battle only by
 *   passing it: the finishing submission completes the quest and its day —
 *   the streak step comes from the day — and the Final Battle's first pass
 *   completes the challenge;
 * - badges catch up through the achievement engine (the 90-day badge follows
 *   from the finished challenge, it is never granted by hand).
 * Submitting, paying, completing the quest, the day and the challenge are one
 * write. A second submit (double tap, reload) returns the stored result and
 * changes nothing.
 */
export async function submitExam(
  repositories: Repositories,
  attemptId: string,
  now: Date = new Date(),
): Promise<ExamSubmission> {
  const stored = (await repositories.exams.getAllAttempts()).find((item) => item.id === attemptId);
  if (!stored) throw new Error(`Unknown exam attempt: ${attemptId}`);
  const exam = await examOf(repositories, stored.questId);
  const { plan, quest } = await findExamQuest(repositories, stored.questId);
  const attempt = restoreAttempt(exam, stored);
  const result = scoreExam(exam, attempt.answers);
  const submittedAt = now.toISOString();

  const reward =
    result.passed && exam.xpReward > 0
      ? {
          amount: exam.xpReward,
          reason: 'examPass' as const,
          refId: exam.id,
          createdAt: submittedAt,
        }
      : null;
  const finishes = exam.type === 'weeklyExam' || result.passed;
  const completion: QuestCompletion | null = finishes
    ? {
        questId: quest.id,
        day: quest.day,
        questType: quest.type,
        score: result.score,
        correctCount: result.correctCount,
        totalCount: result.totalCount,
        // The write keeps what was actually paid.
        xpEarned: reward?.amount ?? 0,
        source: 'user',
        completedAt: submittedAt,
      }
    : null;
  const day = completion ? await dayRecordWith(repositories, plan, completion, submittedAt) : null;
  const challenge: ChallengeCompletion | null =
    completion && exam.type === 'finalBattle'
      ? {
          completedAt: submittedAt,
          finalAttemptId: attempt.id,
          correctCount: result.correctCount,
          totalCount: result.totalCount,
          score: result.score,
          isPerfect: result.isPerfect,
          xpEarned: reward?.amount ?? 0,
          celebratedAt: null,
        }
      : null;

  const outcome = await repositories.exams.submitAttempt({
    attempt: {
      id: attempt.id,
      answers: attempt.answers,
      submittedAt,
      correctCount: result.correctCount,
      score: result.score,
      passed: result.passed,
    },
    completion,
    answers: toAnswerRecords(exam, attempt, submittedAt),
    reward,
    day,
    challenge,
  });

  if (!outcome.submitted) {
    const final = (await repositories.exams.getAttempts(exam.id)).find((a) => a.id === attempt.id);
    const finalAttempt = final ? restoreAttempt(exam, final) : attempt;
    return {
      attempt: finalAttempt,
      result: scoreExam(exam, finalAttempt.answers),
      isFirstSubmission: false,
      rewardGranted: false,
      xpEarned: 0,
      dayCompleted: false,
      day: null,
      challengeCompleted: false,
      newAchievements: [],
    };
  }

  const newAchievements = await syncAchievements(repositories, now);
  return {
    attempt: {
      ...attempt,
      submittedAt,
      updatedAt: submittedAt,
      correctCount: result.correctCount,
      score: result.score,
      passed: result.passed,
    },
    result,
    isFirstSubmission: true,
    rewardGranted: outcome.rewardGranted,
    xpEarned: outcome.rewardGranted ? exam.xpReward : 0,
    dayCompleted: outcome.dayRecorded,
    day: outcome.dayRecorded && day ? { record: day, isFirstCompletion: true } : null,
    challengeCompleted: outcome.challengeRecorded,
    newAchievements,
  };
}
