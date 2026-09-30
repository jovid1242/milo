import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import request from 'supertest';

import { LOCAL_COURSE } from '@/content/course';
import { CourseReader, validatedCourse } from '@/data/repositories/course/course-reader';
import { scorableExercises } from '@/features/progress/logic/quest-scoring';
import {
  SyncResponseSchema,
  type AuthSession,
  type Exam,
  type ExamAnswer,
  type ProgressMutation,
  type ProgressMutationOf,
  type QuestAnswerInput,
  type SyncResponse,
} from '@/schemas';

import { bearer } from './helpers';

/**
 * Playing the real course against the API: answers built from the course
 * content itself, right or wrong on purpose.
 */

export const course = new CourseReader(validatedCourse(LOCAL_COURSE));
export const COURSE_ID = LOCAL_COURSE.id;
export const COURSE_VERSION = LOCAL_COURSE.version;

export const questsOf = (day: number) => course.day(day).quests.map((quest) => quest.id);

/** Every exercise answered — the first `wrong` of them with a wrong option. */
export function questAnswers(questId: string, { wrong = 0 } = {}): QuestAnswerInput[] {
  const content = course.questContent(questId);
  const exercises = content ? scorableExercises(content) : null;
  if (!exercises) throw new Error(`${questId} is not a playable daily quest`);
  return exercises.map((exercise, index) => ({
    exerciseId: exercise.id,
    optionId:
      index < wrong
        ? (exercise.optionIds.find((id) => id !== exercise.correctOptionId) ?? '')
        : exercise.correctOptionId,
  }));
}

export function examOf(questId: string): Exam {
  const content = course.questContent(questId);
  if (content?.type !== 'weeklyExam' && content?.type !== 'finalBattle')
    throw new Error(`${questId} is not an exam`);
  return content;
}

/** The first `correct` questions right, the rest wrong. */
export function examAnswers(questId: string, correct: number): ExamAnswer[] {
  return examOf(questId).questions.map((question, index) => ({
    questionId: question.id,
    optionId:
      index < correct
        ? question.correctOptionId
        : (question.options.find((option) => option.id !== question.correctOptionId)?.id ?? ''),
  }));
}

/** Right answers the exam needs to pass. */
export const passMarkOf = (questId: string) => {
  const exam = examOf(questId);
  return Math.ceil(exam.passingScore * exam.questions.length - 1e-9);
};

type Payload<Type extends ProgressMutation['type']> = ProgressMutationOf<Type>['payload'];

export const mutation = <Type extends ProgressMutation['type']>(
  type: Type,
  payload: Payload<Type>,
  id: string = randomUUID(),
): ProgressMutationOf<Type> =>
  ({ id, type, createdAt: new Date().toISOString(), payload }) as ProgressMutationOf<Type>;

export const startChallenge = (startDate: string, timeZone = 'UTC') =>
  mutation('startChallenge', { courseId: COURSE_ID, startDate, timeZone });

export const completeQuest = (
  questId: string,
  options: { wrong?: number; at?: string; answers?: QuestAnswerInput[] } = {},
) =>
  mutation('completeQuest', {
    courseId: COURSE_ID,
    courseVersion: COURSE_VERSION,
    questId,
    answers: options.answers ?? questAnswers(questId, { wrong: options.wrong ?? 0 }),
    completedAt: options.at ?? new Date().toISOString(),
  });

export const submitExam = (
  questId: string,
  correct: number,
  options: { attemptId?: string; at?: string } = {},
) =>
  mutation('submitExam', {
    courseId: COURSE_ID,
    courseVersion: COURSE_VERSION,
    questId,
    attemptId: options.attemptId ?? `${questId}-${randomUUID()}`,
    answers: examAnswers(questId, correct),
    submittedAt: options.at ?? new Date().toISOString(),
  });

/** One sync request, as a device sends it. */
export async function sync(
  http: Server,
  session: AuthSession,
  mutations: ProgressMutation[],
  knownRevision = 0,
): Promise<SyncResponse> {
  const response = await request(http)
    .post('/api/v1/progress/sync')
    .set('Authorization', bearer(session))
    .send({
      userId: session.user.id,
      courseId: COURSE_ID,
      courseVersion: COURSE_VERSION,
      knownRevision,
      mutations,
    })
    .expect(200);
  return SyncResponseSchema.parse(response.body);
}

/** The progress of every quest of a day played right. */
export const playDay = (day: number, at?: string) =>
  questsOf(day).map((questId) =>
    course.questContent(questId)?.type === 'weeklyExam' ||
    course.questContent(questId)?.type === 'finalBattle'
      ? submitExam(questId, examOf(questId).questions.length, { at })
      : completeQuest(questId, { at }),
  );
