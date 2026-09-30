import type { LocalStore } from '@/data/db/local-store';
import type {
  ExamRepository,
  ExamSubmissionOutcome,
  ExamSubmissionWrite,
} from '@/data/repositories/types';
import { ExamAttemptSchema, type ExamAttempt } from '@/schemas';

import { enqueueMutation } from './outbox';
import {
  writeAnswers,
  writeChallengeCompletion,
  writeCompletion,
  writeDayCompletion,
} from './sqlite-progress-repository';

type AttemptRow = {
  id: string;
  exam_id: string;
  quest_id: string;
  course_version: number;
  number: number;
  started_at: string;
  updated_at: string;
  current_index: number;
  answers_json: string;
  submitted_at: string | null;
  correct_count: number | null;
  total_count: number;
  score: number | null;
  passed: number | null;
};

const mapAttempt = (row: AttemptRow): ExamAttempt =>
  ExamAttemptSchema.parse({
    id: row.id,
    examId: row.exam_id,
    questId: row.quest_id,
    courseVersion: row.course_version,
    number: row.number,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    currentIndex: row.current_index,
    answers: JSON.parse(row.answers_json),
    submittedAt: row.submitted_at,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    score: row.score,
    passed: row.passed === null ? null : row.passed === 1,
  });

/** One owner's exam attempts. */
export class SqliteExamRepository implements ExamRepository {
  constructor(
    private readonly store: LocalStore,
    private readonly owner: string,
  ) {}

  async getAttempts(examId: string): Promise<ExamAttempt[]> {
    const db = await this.store.read();
    const rows = await db.getAllAsync<AttemptRow>(
      'SELECT * FROM exam_attempts WHERE owner_id = ? AND exam_id = ? ORDER BY number ASC',
      [this.owner, examId],
    );
    return rows.map(mapAttempt);
  }

  async getAllAttempts(): Promise<ExamAttempt[]> {
    const db = await this.store.read();
    const rows = await db.getAllAsync<AttemptRow>(
      'SELECT * FROM exam_attempts WHERE owner_id = ? ORDER BY exam_id ASC, number ASC',
      [this.owner],
    );
    return rows.map(mapAttempt);
  }

  async openAttempt(attempt: ExamAttempt): Promise<ExamAttempt> {
    return this.store.write(async (db) => {
      // The unique "open attempt" index turns a second open into a no-op.
      await db.runAsync(
        `INSERT OR IGNORE INTO exam_attempts
           (owner_id, id, exam_id, quest_id, course_version, number, started_at, updated_at,
            current_index, answers_json, submitted_at, correct_count, total_count, score, passed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL)`,
        [
          this.owner,
          attempt.id,
          attempt.examId,
          attempt.questId,
          attempt.courseVersion,
          attempt.number,
          attempt.startedAt,
          attempt.updatedAt,
          attempt.currentIndex,
          JSON.stringify(attempt.answers),
          attempt.totalCount,
        ],
      );
      const open = await db.getFirstAsync<AttemptRow>(
        'SELECT * FROM exam_attempts WHERE owner_id = ? AND exam_id = ? AND submitted_at IS NULL',
        [this.owner, attempt.examId],
      );
      if (!open) throw new Error(`Could not open an attempt at ${attempt.examId}`);
      return mapAttempt(open);
    });
  }

  async saveAttempt(
    attempt: Pick<ExamAttempt, 'id' | 'currentIndex' | 'answers' | 'updatedAt'>,
  ): Promise<boolean> {
    const result = await this.store.write((db) =>
      db.runAsync(
        `UPDATE exam_attempts SET current_index = ?, answers_json = ?, updated_at = ?
         WHERE owner_id = ? AND id = ? AND submitted_at IS NULL`,
        [
          attempt.currentIndex,
          JSON.stringify(attempt.answers),
          attempt.updatedAt,
          this.owner,
          attempt.id,
        ],
      ),
    );
    return result.changes > 0;
  }

  async submitAttempt({
    attempt,
    completion,
    answers,
    reward,
    day,
    challenge,
    mutation = null,
  }: ExamSubmissionWrite): Promise<ExamSubmissionOutcome> {
    const { owner } = this;
    const tag = mutation?.id ?? null;
    let outcome: ExamSubmissionOutcome = {
      submitted: false,
      rewardGranted: false,
      firstCompletion: false,
      dayRecorded: false,
      challengeRecorded: false,
    };
    // One exclusive transaction: submitting, paying, completing the quest, its
    // day and the challenge — and the outbox entry that tells the server —
    // land together or not at all: a force close can never split them.
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        // Only the update that finds it still open changes a row: submitting twice is a no-op.
        const submitted = await txn.runAsync(
          `UPDATE exam_attempts
             SET answers_json = ?, submitted_at = ?, updated_at = ?, correct_count = ?, score = ?,
                 passed = ?, pending_mutation_id = ?
           WHERE owner_id = ? AND id = ? AND submitted_at IS NULL`,
          [
            JSON.stringify(attempt.answers),
            attempt.submittedAt,
            attempt.submittedAt,
            attempt.correctCount,
            attempt.score,
            attempt.passed === null ? null : attempt.passed ? 1 : 0,
            tag,
            owner,
            attempt.id,
          ],
        );
        if (submitted.changes === 0) return;
        if (mutation) await enqueueMutation(txn, owner, mutation);

        // The unique index on (owner, reason, ref) keeps the reward to one per exam.
        const paid = reward
          ? await txn.runAsync(
              `INSERT OR IGNORE INTO xp_events
                 (owner_id, amount, reason, ref_id, created_at, pending_mutation_id)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [owner, reward.amount, reward.reason, reward.refId, reward.createdAt, tag],
            )
          : null;
        const rewardGranted = (paid?.changes ?? 0) > 0;
        const earned = rewardGranted && reward ? reward.amount : 0;

        // The attempt is over: Home no longer shows it in progress.
        await txn.runAsync(
          `DELETE FROM quest_sessions WHERE owner_id = ? AND quest_id =
             (SELECT quest_id FROM exam_attempts WHERE owner_id = ? AND id = ?)`,
          [owner, owner, attempt.id],
        );
        const existing = completion
          ? await txn.getFirstAsync<{ quest_id: string }>(
              'SELECT quest_id FROM quest_completions WHERE owner_id = ? AND quest_id = ?',
              [owner, completion.questId],
            )
          : null;
        let firstCompletion = false;
        let dayRecorded = false;
        let challengeRecorded = false;
        if (completion && existing) {
          // A retake: the quest keeps its first result; a first pass adds its reward.
          if (earned > 0) {
            await txn.runAsync(
              'UPDATE quest_completions SET xp_earned = xp_earned + ? WHERE owner_id = ? AND quest_id = ?',
              [earned, owner, completion.questId],
            );
          }
        } else if (completion) {
          await writeCompletion(txn, owner, { ...completion, xpEarned: earned }, tag);
          await writeAnswers(txn, owner, completion.questId, answers);
          firstCompletion = true;
          if (day) dayRecorded = await writeDayCompletion(txn, owner, day, tag);
          if (challenge) {
            challengeRecorded = await writeChallengeCompletion(
              txn,
              owner,
              { ...challenge, xpEarned: earned },
              tag,
            );
          }
        }
        outcome = {
          submitted: true,
          rewardGranted,
          firstCompletion,
          dayRecorded,
          challengeRecorded,
        };
      }),
    );
    return outcome;
  }
}
