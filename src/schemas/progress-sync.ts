import { z } from 'zod';

import { AchievementIdSchema } from './achievement';
import { DayNumberSchema, IdSchema, LocalDateSchema, ScoreSchema, TimestampSchema } from './common';
import { ExamAnswerSchema } from './exam';
import {
  ChallengeCompletionSchema,
  CourseVersionSchema,
  DayCompletionSchema,
  LearnedWordSchema,
} from './progress';
import { QuestTypeSchema } from './quest';

/**
 * Progress sync: the contract between the app's offline outbox and the
 * server, which owns progress. The app never tells the server what the user
 * earned — no XP, no streak, no badge, no finished day. It sends what the user
 * did (started the challenge, answered a quest, handed in an exam) and the
 * server decides, from the course, what that was worth. What comes back is the
 * account's whole progress: the app's copy is a projection of it.
 */

export const PROGRESS_SYNC = {
  /** Mutations per request: a longer outbox goes in several requests, in order. */
  batchLimit: 50,
  /** Answers in one quest or exam — far above any real one. */
  maxAnswers: 100,
  /**
   * How late a day's quests may reach the server, in challenge days: a week
   * offline still counts. Older play cannot be told apart from a clock turned
   * back, and is refused.
   */
  maxLateDays: 7,
  /** How far ahead of the server's day a device may be: time zones and clock drift. */
  maxEarlyDays: 1,
} as const;

/** Every offline action has one, made on the device: sending it twice changes nothing. */
export const MutationIdSchema = z.uuid();

/** An IANA time zone name as the device reports it, e.g. `Asia/Tashkent`. */
export const TimeZoneSchema = z.string().min(1).max(64);

/** A choice in a daily quest: the exercise and the option picked. Whether it was right is the server's to say. */
export const QuestAnswerInputSchema = z.strictObject({ exerciseId: IdSchema, optionId: IdSchema });
export type QuestAnswerInput = z.infer<typeof QuestAnswerInputSchema>;

const QuestAnswersSchema = z.array(QuestAnswerInputSchema).max(PROGRESS_SYNC.maxAnswers);
const ExamAnswersSchema = z.array(ExamAnswerSchema).max(PROGRESS_SYNC.maxAnswers);

export const StartChallengePayloadSchema = z.strictObject({
  courseId: IdSchema,
  /** Day 1: the device's calendar date when onboarding finished. */
  startDate: LocalDateSchema,
  /** Where the challenge started: the server's day boundaries follow it. */
  timeZone: TimeZoneSchema,
});
export type StartChallengePayload = z.infer<typeof StartChallengePayloadSchema>;

export const CompleteQuestPayloadSchema = z.strictObject({
  courseId: IdSchema,
  /** The course version the quest was played on: the answers refer to its exercises. */
  courseVersion: CourseVersionSchema,
  questId: IdSchema,
  answers: QuestAnswersSchema,
  /** When the device finished it: kept for display, never used for rewards or availability. */
  completedAt: TimestampSchema,
});
export type CompleteQuestPayload = z.infer<typeof CompleteQuestPayloadSchema>;

export const SubmitExamPayloadSchema = z.strictObject({
  courseId: IdSchema,
  courseVersion: CourseVersionSchema,
  questId: IdSchema,
  /** The device's attempt id: the attempt is known by it on every device. */
  attemptId: IdSchema,
  /** Unanswered questions are simply missing: they count as not right. */
  answers: ExamAnswersSchema,
  submittedAt: TimestampSchema,
});
export type SubmitExamPayload = z.infer<typeof SubmitExamPayloadSchema>;

/**
 * Progress made on this device before accounts, claimed once by the first
 * account signed in here (see `docs/progress-sync.md`). Only what was played —
 * the answers — travels; the server scores it and derives the rest.
 */
export const ImportLegacyProgressPayloadSchema = z.strictObject({
  courseId: IdSchema,
  courseVersion: CourseVersionSchema,
  startDate: LocalDateSchema,
  timeZone: TimeZoneSchema,
  quests: z
    .array(
      z.strictObject({
        questId: IdSchema,
        answers: QuestAnswersSchema,
        completedAt: TimestampSchema,
      }),
    )
    .max(400),
  exams: z
    .array(
      z.strictObject({
        questId: IdSchema,
        attemptId: IdSchema,
        answers: ExamAnswersSchema,
        submittedAt: TimestampSchema,
      }),
    )
    .max(200),
});
export type ImportLegacyProgressPayload = z.infer<typeof ImportLegacyProgressPayloadSchema>;

const mutation = <Type extends string, Payload extends z.ZodType>(type: Type, payload: Payload) =>
  z.strictObject({
    id: MutationIdSchema,
    type: z.literal(type),
    /** When the device recorded it: metadata only. */
    createdAt: TimestampSchema,
    payload,
  });

/** One thing the user did, as the outbox keeps it and the server receives it. */
export const ProgressMutationSchema = z.discriminatedUnion('type', [
  mutation('startChallenge', StartChallengePayloadSchema),
  mutation('completeQuest', CompleteQuestPayloadSchema),
  mutation('submitExam', SubmitExamPayloadSchema),
  mutation('importLegacyProgress', ImportLegacyProgressPayloadSchema),
]);
export type ProgressMutation = z.infer<typeof ProgressMutationSchema>;
export type ProgressMutationType = ProgressMutation['type'];
export type ProgressMutationOf<Type extends ProgressMutationType> = Extract<
  ProgressMutation,
  { type: Type }
>;

/** `POST /progress/sync`. */
export const SyncRequestSchema = z.strictObject({
  /**
   * The account whose outbox this is. Checked against the access token: a
   * device's mutations can never land on another account.
   */
  userId: z.uuid(),
  courseId: IdSchema,
  /** The course version the device uses now. */
  courseVersion: CourseVersionSchema,
  /** The revision the device's copy reflects; 0 before its first sync. */
  knownRevision: z.number().int().nonnegative(),
  /** Oldest first: the server applies them in this order. */
  mutations: z.array(ProgressMutationSchema).max(PROGRESS_SYNC.batchLimit),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

/** Why the server refused a mutation. Final: the same mutation is refused the same way again. */
export const MutationRejectionCodeSchema = z.enum([
  'CHALLENGE_NOT_STARTED',
  'INVALID_START_DATE',
  'INVALID_TIME_ZONE',
  'COURSE_MISMATCH',
  'UNKNOWN_QUEST',
  'QUEST_NOT_AVAILABLE',
  'QUEST_LOCKED',
  'INVALID_ANSWERS',
  'LEGACY_IMPORT_NOT_ALLOWED',
  'MUTATION_ID_REUSED',
]);
export type MutationRejectionCode = z.infer<typeof MutationRejectionCodeSchema>;

/**
 * - `accepted`: applied now (it may have changed nothing — a quest finished
 *   already on another device stays finished once);
 * - `duplicate`: this mutation id was applied before — a retry;
 * - `rejected`: refused for good, with a `code`.
 */
export const MutationStatusSchema = z.enum(['accepted', 'duplicate', 'rejected']);
export type MutationStatus = z.infer<typeof MutationStatusSchema>;

export const MutationResultSchema = z.object({
  mutationId: MutationIdSchema,
  status: MutationStatusSchema,
  code: MutationRejectionCodeSchema.optional(),
  message: z.string().optional(),
});
export type MutationResult = z.infer<typeof MutationResultSchema>;

/** Progress as the server holds it — what the app's projection is made of. */
export const SyncedQuestCompletionSchema = z.object({
  questId: IdSchema,
  courseVersion: CourseVersionSchema,
  day: DayNumberSchema,
  questType: QuestTypeSchema,
  score: ScoreSchema,
  correctCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  xpEarned: z.number().int().nonnegative(),
  completedAt: TimestampSchema,
});
export type SyncedQuestCompletion = z.infer<typeof SyncedQuestCompletionSchema>;

export const SyncedDayCompletionSchema = DayCompletionSchema.omit({ celebratedAt: true });
export type SyncedDayCompletion = z.infer<typeof SyncedDayCompletionSchema>;

export const SyncedExamAttemptSchema = z.object({
  id: IdSchema,
  examId: IdSchema,
  questId: IdSchema,
  courseVersion: CourseVersionSchema,
  number: z.number().int().positive(),
  answers: z.array(ExamAnswerSchema),
  submittedAt: TimestampSchema,
  correctCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  score: ScoreSchema,
  passed: z.boolean(),
});
export type SyncedExamAttempt = z.infer<typeof SyncedExamAttemptSchema>;

/** The XP ledger: one entry per reward, never two for the same reason and reference. */
export const SyncedXpReasonSchema = z.enum(['quest', 'examPass', 'achievement']);
export const SyncedXpEventSchema = z.object({
  amount: z.number().int(),
  reason: SyncedXpReasonSchema,
  refId: IdSchema,
  createdAt: TimestampSchema,
});
export type SyncedXpEvent = z.infer<typeof SyncedXpEventSchema>;

export const SyncedAchievementUnlockSchema = z.object({
  achievementId: AchievementIdSchema,
  unlockedAt: TimestampSchema,
});
export type SyncedAchievementUnlock = z.infer<typeof SyncedAchievementUnlockSchema>;

export const SyncedChallengeCompletionSchema = ChallengeCompletionSchema.omit({
  celebratedAt: true,
});
export type SyncedChallengeCompletion = z.infer<typeof SyncedChallengeCompletionSchema>;

/**
 * The challenge itself. `currentDay`, `streak`, `totalXp`, `completedDays`
 * and `wordsLearned` are derived by the server when it answers, from the
 * records below and its clock — never stored, never taken from a device.
 */
export const SyncedChallengeSchema = z.object({
  courseId: IdSchema,
  startDate: LocalDateSchema,
  timeZone: TimeZoneSchema,
  startedAt: TimestampSchema,
  currentDay: DayNumberSchema,
  streak: z.number().int().nonnegative(),
  totalXp: z.number().int(),
  completedDays: z.array(DayNumberSchema),
  wordsLearned: z.number().int().nonnegative(),
});
export type SyncedChallenge = z.infer<typeof SyncedChallengeSchema>;

export const ProgressSnapshotSchema = z.object({
  /** `null` until the challenge is started. */
  challenge: SyncedChallengeSchema.nullable(),
  questCompletions: z.array(SyncedQuestCompletionSchema),
  dayCompletions: z.array(SyncedDayCompletionSchema),
  learnedWords: z.array(LearnedWordSchema),
  examAttempts: z.array(SyncedExamAttemptSchema),
  xpEvents: z.array(SyncedXpEventSchema),
  achievementUnlocks: z.array(SyncedAchievementUnlockSchema),
  challengeCompletion: SyncedChallengeCompletionSchema.nullable(),
});
export type ProgressSnapshot = z.infer<typeof ProgressSnapshotSchema>;

export const SyncResponseSchema = z.object({
  /** The account's progress revision after this request: it only ever goes up. */
  revision: z.number().int().nonnegative(),
  /** One per mutation sent, in the same order. */
  results: z.array(MutationResultSchema),
  /** The whole progress when it changed since `knownRevision`; `null` when the device is up to date. */
  progress: ProgressSnapshotSchema.nullable(),
});
export type SyncResponse = z.infer<typeof SyncResponseSchema>;

/** `GET /progress`. */
export const ProgressResponseSchema = z.object({
  revision: z.number().int().nonnegative(),
  progress: ProgressSnapshotSchema,
});
export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;
