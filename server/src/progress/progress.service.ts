import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { ACHIEVEMENTS } from '@/data/content/achievements';
import type { AchievementFacts } from '@/features/achievements/logic/evaluate-achievements';
import { challengeDayOn } from '@/features/challenge/logic/calendar';
import { findCompletedDays } from '@/features/progress/logic/day-completion';
import { computeStreak } from '@/features/progress/logic/streak';
import { addDays } from '@/lib/dates';
import { localDateIn } from '@/lib/time-zone';
import {
  AchievementIdSchema,
  ExamAnswerSchema,
  ProgressSnapshotSchema,
  QuestTypeSchema,
  type MutationResult,
  type ProgressMutation,
  type ProgressResponse,
  type ProgressSnapshot,
  type QuestCompletion,
  type SyncRequest,
  type SyncResponse,
} from '@/schemas';

import { ApiException } from '../common/api-exception';
import { CLOCK, type Clock } from '../common/clock';
import { CourseService } from '../course/course.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamNews } from '../push/team-news';
import { loadRoster, rosterStreak } from '../teams/team-progress';
import {
  ChallengeWork,
  emptyState,
  type ChallengeRecord,
  type ChallengeState,
  type ChallengeWrites,
  type CourseContent,
  type Rejection,
} from './challenge-work';

type Tx = Prisma.TransactionClient;

const WITH_RECORDS = {
  questCompletions: true,
  dayCompletions: true,
  learnedWords: true,
  examAttempts: true,
  xpLedger: true,
  achievements: true,
} as const;

type StoredChallenge = Prisma.UserChallengeGetPayload<{ include: typeof WITH_RECORDS }>;

const ExamAnswersSchema = z.array(ExamAnswerSchema);

const iso = (date: Date) => date.toISOString();
/** A `date` column: midnight UTC of the calendar date. */
const toLocalDate = (date: Date) => date.toISOString().slice(0, 10);
const fromLocalDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

/** Transactions that may write a whole legacy history get room to. */
const TRANSACTION = { maxWait: 10_000, timeout: 30_000 } as const;

/** The badge a team earns together, and the team days in a row it takes. */
const TEAM_BADGE = ACHIEVEMENTS.flatMap((achievement) =>
  achievement.rule.type === 'teamStreak'
    ? [{ id: achievement.id, days: achievement.rule.count }]
    : [],
)[0];

function toState(stored: StoredChallenge | null): ChallengeState {
  if (!stored) return emptyState();
  return {
    challenge: {
      id: stored.id,
      courseId: stored.courseId,
      startDate: toLocalDate(stored.startDate),
      timeZone: stored.timeZone,
      startedAt: stored.startedAt,
      completedAt: stored.completedAt,
      finalAttemptId: stored.finalAttemptId,
      revision: stored.revision,
    },
    completions: stored.questCompletions.map((row) => ({
      questId: row.questId,
      day: row.day,
      questType: QuestTypeSchema.parse(row.questType),
      courseVersion: row.courseVersion,
      correctCount: row.correctCount,
      totalCount: row.totalCount,
      xpEarned: row.xpEarned,
      completedAt: row.completedAt,
    })),
    days: stored.dayCompletions.map((row) => ({
      day: row.day,
      questCount: row.questCount,
      xpEarned: row.xpEarned,
      streakBefore: row.streakBefore,
      streakAfter: row.streakAfter,
      isPerfect: row.isPerfect,
      completedAt: row.completedAt,
    })),
    words: stored.learnedWords.map((row) => ({
      wordId: row.wordId,
      questId: row.questId,
      learnedAt: row.learnedAt,
    })),
    attempts: stored.examAttempts.map((row) => ({
      attemptId: row.attemptId,
      examId: row.examId,
      questId: row.questId,
      number: row.number,
      courseVersion: row.courseVersion,
      answers: ExamAnswersSchema.parse(row.answers),
      correctCount: row.correctCount,
      totalCount: row.totalCount,
      passed: row.passed,
      submittedAt: row.submittedAt,
    })),
    ledger: stored.xpLedger.map((row) => ({
      reason: row.reason,
      refId: row.refId,
      amount: row.amount,
      createdAt: row.createdAt,
    })),
    unlocks: stored.achievements.map((row) => ({
      achievementId: AchievementIdSchema.parse(row.achievementId),
      unlockedAt: row.unlockedAt,
    })),
  };
}

const byTime =
  <T>(time: (item: T) => Date, tie: (item: T) => string) =>
  (a: T, b: T) =>
    time(a).getTime() - time(b).getTime() || tie(a).localeCompare(tie(b));

/**
 * The account's progress as devices receive it. Totals, the streak, the
 * current day and the completed days are derived here, from the records and
 * the server's clock — they are never stored.
 */
function toSnapshot(
  stored: StoredChallenge | null,
  course: CourseContent,
  now: Date,
): ProgressSnapshot {
  const state = toState(stored);
  const challenge = state.challenge;
  if (!challenge) {
    return {
      challenge: null,
      questCompletions: [],
      dayCompletions: [],
      learnedWords: [],
      examAttempts: [],
      xpEvents: [],
      achievementUnlocks: [],
      challengeCompletion: null,
    };
  }
  const completions: QuestCompletion[] = state.completions
    .sort(
      (a, b) =>
        a.day - b.day ||
        a.completedAt.getTime() - b.completedAt.getTime() ||
        a.questId.localeCompare(b.questId),
    )
    .map((row) => ({
      questId: row.questId,
      courseVersion: row.courseVersion,
      day: row.day,
      questType: row.questType,
      score: row.totalCount > 0 ? row.correctCount / row.totalCount : 1,
      correctCount: row.correctCount,
      totalCount: row.totalCount,
      xpEarned: row.xpEarned,
      source: 'user',
      completedAt: iso(row.completedAt),
    }));
  const completedDays = [...findCompletedDays(course.plans, completions)].sort((a, b) => a - b);
  const currentDay = challengeDayOn(challenge.startDate, localDateIn(challenge.timeZone, now));
  const final = challenge.finalAttemptId
    ? state.attempts.find((attempt) => attempt.attemptId === challenge.finalAttemptId)
    : undefined;
  const finalQuest = final
    ? state.completions.find((completion) => completion.questId === final.questId)
    : undefined;

  return ProgressSnapshotSchema.parse({
    challenge: {
      courseId: challenge.courseId,
      startDate: challenge.startDate,
      timeZone: challenge.timeZone,
      startedAt: iso(challenge.startedAt),
      currentDay,
      streak: computeStreak(new Set(completedDays), currentDay),
      totalXp: state.ledger.reduce((sum, entry) => sum + entry.amount, 0),
      completedDays,
      wordsLearned: state.words.length,
    },
    questCompletions: completions.map(({ source: _source, ...completion }) => completion),
    dayCompletions: state.days
      .sort((a, b) => a.day - b.day)
      .map((day) => ({ ...day, completedAt: iso(day.completedAt) })),
    learnedWords: state.words
      .sort(
        byTime(
          (word) => word.learnedAt,
          (word) => word.wordId,
        ),
      )
      .map((word) => ({ ...word, learnedAt: iso(word.learnedAt) })),
    examAttempts: state.attempts
      .sort((a, b) => a.examId.localeCompare(b.examId) || a.number - b.number)
      .map((attempt) => ({
        id: attempt.attemptId,
        examId: attempt.examId,
        questId: attempt.questId,
        courseVersion: attempt.courseVersion,
        number: attempt.number,
        answers: attempt.answers,
        submittedAt: iso(attempt.submittedAt),
        correctCount: attempt.correctCount,
        totalCount: attempt.totalCount,
        score: attempt.correctCount / attempt.totalCount,
        passed: attempt.passed,
      })),
    xpEvents: state.ledger
      .sort(
        byTime(
          (entry) => entry.createdAt,
          (entry) => `${entry.reason}:${entry.refId}`,
        ),
      )
      .map((entry) => ({ ...entry, createdAt: iso(entry.createdAt) })),
    achievementUnlocks: state.unlocks
      .sort(
        byTime(
          (unlock) => unlock.unlockedAt,
          (unlock) => unlock.achievementId,
        ),
      )
      .map((unlock) => ({ ...unlock, unlockedAt: iso(unlock.unlockedAt) })),
    challengeCompletion:
      challenge.completedAt && final
        ? {
            completedAt: iso(challenge.completedAt),
            finalAttemptId: final.attemptId,
            correctCount: final.correctCount,
            totalCount: final.totalCount,
            score: final.correctCount / final.totalCount,
            isPerfect: final.correctCount === final.totalCount,
            xpEarned: finalQuest?.xpEarned ?? 0,
          }
        : null,
  });
}

/** What the mutation is about, and when the device says it happened. */
function deviceTime(mutation: ProgressMutation): string | null {
  switch (mutation.type) {
    case 'completeQuest':
      return mutation.payload.completedAt;
    case 'submitExam':
      return mutation.payload.submittedAt;
    case 'startChallenge':
    case 'importLegacyProgress':
      return null;
  }
}

const courseVersionOf = (mutation: ProgressMutation): number | null =>
  'courseVersion' in mutation.payload ? mutation.payload.courseVersion : null;

/** Applies a mutation to the work; `null` when it is accepted. */
function decide(work: ChallengeWork, mutation: ProgressMutation): Rejection | null {
  switch (mutation.type) {
    case 'startChallenge':
      return work.startChallenge(mutation.payload);
    case 'completeQuest':
      return work.completeQuest(mutation.payload, { history: false });
    case 'submitExam':
      return work.submitExam(mutation.payload, { history: false });
    case 'importLegacyProgress': {
      const outcome = work.importLegacy(mutation.payload);
      return 'code' in outcome ? outcome : null;
    }
  }
}

/**
 * Progress, owned by the server. Devices send what the user did; each
 * mutation is decided in its own transaction — with the user's row locked, so
 * two devices syncing at once take turns — and recorded with its outcome, so
 * a retry is answered the same way and changes nothing.
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly course: CourseService,
    private readonly news: TeamNews,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** `GET /progress`: the whole progress of the course, as it stands. */
  async progress(userId: string, courseId?: string): Promise<ProgressResponse> {
    const content = this.course.content();
    if (courseId !== undefined && courseId !== content.id) throw this.courseMismatch(content);
    const { revision, progress } = await this.read(userId, content, null);
    return { revision, progress: progress ?? toSnapshot(null, content, this.clock.now()) };
  }

  /** `POST /progress/sync`: applies the mutations in order, then answers with the progress. */
  async sync(userId: string, request: SyncRequest): Promise<SyncResponse> {
    const started = performance.now();
    if (request.userId !== userId) {
      throw new ApiException(
        409,
        'ACCOUNT_MISMATCH',
        'These changes belong to another account than the one signed in.',
      );
    }
    const content = this.course.content();
    if (request.courseId !== content.id) throw this.courseMismatch(content);
    const outdated = request.mutations.find((mutation) => {
      const version = courseVersionOf(mutation);
      return version !== null && version !== content.version;
    });
    if (outdated) {
      // Nothing is applied: the order of an outbox matters, so it waits whole.
      throw new ApiException(
        409,
        'COURSE_VERSION_UNSUPPORTED',
        `Progress made on course version ${courseVersionOf(outdated)} cannot be checked by this server.`,
        { supportedVersion: content.version },
      );
    }

    const revisionBefore = await this.revision(userId, content.id);
    const results: MutationResult[] = [];
    for (const mutation of request.mutations) {
      results.push(await this.apply(userId, mutation, content));
    }
    await this.settleTeamBadge(userId, content);
    const { revision, progress } = await this.read(userId, content, request.knownRevision);

    const count = (status: MutationResult['status']) =>
      results.filter((result) => result.status === status).length;
    const rejections = results.flatMap((result) => (result.code ? [result.code] : []));
    this.logger.log(
      {
        userId,
        courseVersion: request.courseVersion,
        mutations: request.mutations.length,
        accepted: count('accepted'),
        duplicate: count('duplicate'),
        rejected: count('rejected'),
        ...(rejections.length > 0 ? { rejections } : {}),
        revisionBefore,
        revisionAfter: revision,
        snapshot: progress !== null,
        durationMs: Math.round(performance.now() - started),
      },
      'Progress sync',
    );
    return { revision, results, progress };
  }

  private courseMismatch(content: CourseContent) {
    return new ApiException(
      409,
      'COURSE_MISMATCH',
      `This server keeps progress for the course "${content.id}".`,
    );
  }

  private async revision(userId: string, courseId: string): Promise<number> {
    const challenge = await this.prisma.userChallenge.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { revision: true },
    });
    return challenge?.revision ?? 0;
  }

  /** One mutation, one transaction: decided, written and recorded together — or not at all. */
  private apply(
    userId: string,
    mutation: ProgressMutation,
    content: CourseContent,
  ): Promise<MutationResult> {
    const payloadHash = createHash('sha256').update(JSON.stringify(mutation)).digest('hex');
    return this.prisma.$transaction(async (tx): Promise<MutationResult> => {
      // Every progress write of this user waits here for the one before it.
      // NO KEY UPDATE: writes of this user still take turns, while others may
      // still point at the row — a teammate's progress queuing news for them.
      await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${userId}::uuid FOR NO KEY UPDATE`;

      const processed = await tx.processedMutation.findUnique({
        where: { userId_mutationId: { userId, mutationId: mutation.id } },
      });
      if (processed) {
        return processed.payloadHash === payloadHash
          ? { mutationId: mutation.id, status: 'duplicate' }
          : {
              mutationId: mutation.id,
              status: 'rejected',
              code: 'MUTATION_ID_REUSED',
              message: 'This mutation id was already used for a different change.',
            };
      }

      const stored = await tx.userChallenge.findUnique({
        where: { userId_courseId: { userId, courseId: content.id } },
        include: WITH_RECORDS,
      });
      const state = toState(stored);
      const now = this.clock.now();
      const work = new ChallengeWork(state, content, now);
      const rejection = decide(work, mutation);
      let revision = state.challenge?.revision ?? 0;
      if (!rejection) {
        const time = deviceTime(mutation);
        const at = time && new Date(time).getTime() < now.getTime() ? new Date(time) : now;
        work.settleAchievements(at, await this.teamStreak(tx, userId, content, work));
        if (work.changed) {
          revision = await this.write(tx, userId, state.challenge, work.writes, mutation.id);
          await this.announceToday(tx, userId, content, work, mutation, now);
        }
      }
      await tx.processedMutation.create({
        data: {
          userId,
          mutationId: mutation.id,
          type: mutation.type,
          payloadHash,
          status: rejection ? 'rejected' : 'accepted',
          code: rejection?.code ?? null,
          revision,
        },
      });
      return rejection
        ? { mutationId: mutation.id, status: 'rejected', ...rejection }
        : { mutationId: mutation.id, status: 'accepted' };
    }, TRANSACTION);
  }

  /**
   * Today's challenge day finished with this mutation — played, not imported:
   * the team hears of it, in this transaction (the push outbox). A day
   * finished late, after time offline, is old news and stays quiet.
   */
  private async announceToday(
    tx: Tx,
    userId: string,
    content: CourseContent,
    work: ChallengeWork,
    mutation: ProgressMutation,
    now: Date,
  ): Promise<void> {
    if (mutation.type !== 'completeQuest' && mutation.type !== 'submitExam') return;
    const today = work.today();
    const startDate = work.startDate();
    if (!today || !startDate) return;
    const finishedToday = work.writes.days.some(
      (record) => addDays(startDate, record.day - 1) === today,
    );
    if (!finishedToday) return;
    await this.news.dayCompleted(tx, { userId, courseId: content.id, date: today, now });
  }

  /**
   * The team streak facts for the badge: the user's team from the server's
   * records, with the user's own finished days as this work has them (its
   * newest day is not written yet). `null` without a team to share it with.
   */
  private async teamStreak(
    tx: Tx,
    userId: string,
    content: CourseContent,
    work: ChallengeWork,
  ): Promise<AchievementFacts['teamStreak']> {
    const today = work.today();
    if (!today) return null;
    const membership = await tx.teamMember.findUnique({
      where: { userId },
      select: { teamId: true },
    });
    if (!membership) return null;
    const roster = await loadRoster(tx, membership.teamId, content.id);
    if (roster.length < 2) return null;
    const { current, longest } = rosterStreak(roster, today, {
      userId,
      completedDays: work.completedDays(),
    });
    return { current, longest };
  }

  /**
   * The team badge can be earned by a teammate's day, not only by the user's
   * own: every sync checks for it, so each member gets it — once — the next
   * time their device syncs. Granted by the server itself, with no mutation.
   */
  private async settleTeamBadge(userId: string, content: CourseContent): Promise<void> {
    if (!TEAM_BADGE) return;
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId },
      select: { teamId: true },
    });
    if (!membership) return;
    const unlocked = await this.prisma.achievementUnlock.count({
      where: { achievementId: TEAM_BADGE.id, challenge: { userId, courseId: content.id } },
    });
    if (unlocked > 0) return;
    // Read first: only a run long enough is worth the locked write.
    const roster = await loadRoster(this.prisma, membership.teamId, content.id);
    const own = roster.find((member) => member.userId === userId)?.challenge;
    if (roster.length < 2 || !own) return;
    const today = localDateIn(own.timeZone, this.clock.now());
    if (rosterStreak(roster, today).longest < TEAM_BADGE.days) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${userId}::uuid FOR NO KEY UPDATE`;
      const stored = await tx.userChallenge.findUnique({
        where: { userId_courseId: { userId, courseId: content.id } },
        include: WITH_RECORDS,
      });
      if (!stored) return;
      const state = toState(stored);
      const now = this.clock.now();
      const work = new ChallengeWork(state, content, now);
      work.settleAchievements(now, await this.teamStreak(tx, userId, content, work));
      if (!work.changed) return;
      const revision = await this.write(tx, userId, state.challenge, work.writes, null);
      this.logger.log(
        { userId, unlocked: work.writes.unlocks.map((unlock) => unlock.achievementId), revision },
        'Team badge',
      );
    }, TRANSACTION);
  }

  /**
   * Writes what a mutation added and moves the revision on; returns the new
   * revision. `mutationId` is `null` for what the server grants on its own.
   */
  async write(
    tx: Tx,
    userId: string,
    existing: ChallengeRecord | null,
    writes: ChallengeWrites,
    mutationId: string | null,
  ): Promise<number> {
    let challengeId: string;
    let revision: number;
    if (existing?.id) {
      const updated = await tx.userChallenge.update({
        where: { id: existing.id },
        data: {
          revision: { increment: 1 },
          ...(writes.summit
            ? {
                completedAt: writes.summit.completedAt,
                finalAttemptId: writes.summit.finalAttemptId,
              }
            : {}),
        },
        select: { id: true, revision: true },
      });
      challengeId = updated.id;
      revision = updated.revision;
    } else {
      const start = writes.challenge;
      if (!start) throw new Error('A new challenge has to be started first');
      const created = await tx.userChallenge.create({
        data: {
          userId,
          courseId: start.courseId,
          startDate: fromLocalDate(start.startDate),
          timeZone: start.timeZone,
          startedAt: start.startedAt,
          completedAt: writes.summit?.completedAt ?? null,
          finalAttemptId: writes.summit?.finalAttemptId ?? null,
          revision: 1,
        },
        select: { id: true, revision: true },
      });
      challengeId = created.id;
      revision = created.revision;
    }
    await this.writeRecords(tx, challengeId, writes, mutationId);
    return revision;
  }

  /** The records themselves. Unique keys make a second copy of any of them impossible. */
  async writeRecords(
    tx: Tx,
    challengeId: string,
    writes: ChallengeWrites,
    mutationId: string | null,
  ) {
    const played = () => {
      if (mutationId === null) throw new Error('Quests and exams are recorded by a mutation');
      return mutationId;
    };
    if (writes.completions.length > 0) {
      await tx.questCompletion.createMany({
        data: writes.completions.map(({ answers, ...completion }) => ({
          ...completion,
          challengeId,
          mutationId: played(),
          answers: answers ?? Prisma.DbNull,
        })),
      });
    }
    for (const { questId, add } of writes.completionXp) {
      await tx.questCompletion.update({
        where: { challengeId_questId: { challengeId, questId } },
        data: { xpEarned: { increment: add } },
      });
    }
    if (writes.days.length > 0) {
      await tx.dayCompletion.createMany({
        data: writes.days.map((day) => ({ ...day, challengeId })),
      });
    }
    if (writes.words.length > 0) {
      await tx.learnedWord.createMany({
        data: writes.words.map((word) => ({ ...word, challengeId })),
      });
    }
    if (writes.attempts.length > 0) {
      await tx.examAttempt.createMany({
        data: writes.attempts.map((attempt) => ({
          ...attempt,
          challengeId,
          mutationId: played(),
        })),
      });
    }
    if (writes.ledger.length > 0) {
      await tx.xpLedgerEntry.createMany({
        data: writes.ledger.map((entry) => ({ ...entry, challengeId, mutationId })),
      });
    }
    if (writes.unlocks.length > 0) {
      await tx.achievementUnlock.createMany({
        data: writes.unlocks.map((unlock) => ({ ...unlock, challengeId, mutationId })),
      });
    }
  }

  /**
   * The progress as one consistent picture (a repeatable-read transaction):
   * `null` when the device already has this revision.
   */
  private read(
    userId: string,
    content: CourseContent,
    knownRevision: number | null,
  ): Promise<{ revision: number; progress: ProgressSnapshot | null }> {
    return this.prisma.$transaction(
      async (tx) => {
        const stored = await tx.userChallenge.findUnique({
          where: { userId_courseId: { userId, courseId: content.id } },
          include: WITH_RECORDS,
        });
        const revision = stored?.revision ?? 0;
        if (knownRevision !== null && knownRevision === revision)
          return { revision, progress: null };
        return { revision, progress: toSnapshot(stored, content, this.clock.now()) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
