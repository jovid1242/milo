import { getDatabase, writeDatabase } from '@/data/db/database';
import type {
  ExamRepository,
  ExamSubmissionOutcome,
  ExamSubmissionWrite,
} from '@/data/repositories/types';
import { ExamAttemptSchema, type ExamAttempt } from '@/schemas';

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

export class SqliteExamRepository implements ExamRepository {
  async getAttempts(examId: string): Promise<ExamAttempt[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<AttemptRow>(
      'SELECT * FROM exam_attempts WHERE exam_id = ? ORDER BY number ASC',
      [examId],
    );
    return rows.map(mapAttempt);
  }

  async getAllAttempts(): Promise<ExamAttempt[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<AttemptRow>(
      'SELECT * FROM exam_attempts ORDER BY exam_id ASC, number ASC',
    );
    return rows.map(mapAttempt);
  }

  async openAttempt(attempt: ExamAttempt): Promise<ExamAttempt> {
    return writeDatabase(async (db) => {
      // The unique "open attempt" index turns a second open into a no-op.
      await db.runAsync(
        `INSERT OR IGNORE INTO exam_attempts
           (id, exam_id, quest_id, number, started_at, updated_at, current_index, answers_json,
            submitted_at, correct_count, total_count, score, passed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL)`,
        [
          attempt.id,
          attempt.examId,
          attempt.questId,
          attempt.number,
          attempt.startedAt,
          attempt.updatedAt,
          attempt.currentIndex,
          JSON.stringify(attempt.answers),
          attempt.totalCount,
        ],
      );
      const open = await db.getFirstAsync<AttemptRow>(
        'SELECT * FROM exam_attempts WHERE exam_id = ? AND submitted_at IS NULL',
        [attempt.examId],
      );
      if (!open) throw new Error(`Could not open an attempt at ${attempt.examId}`);
      return mapAttempt(open);
    });
  }

  async saveAttempt(
    attempt: Pick<ExamAttempt, 'id' | 'currentIndex' | 'answers' | 'updatedAt'>,
  ): Promise<boolean> {
    const result = await writeDatabase((db) =>
      db.runAsync(
        `UPDATE exam_attempts SET current_index = ?, answers_json = ?, updated_at = ?
         WHERE id = ? AND submitted_at IS NULL`,
        [attempt.currentIndex, JSON.stringify(attempt.answers), attempt.updatedAt, attempt.id],
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
  }: ExamSubmissionWrite): Promise<ExamSubmissionOutcome> {
    let outcome: ExamSubmissionOutcome = {
      submitted: false,
      rewardGranted: false,
      firstCompletion: false,
      dayRecorded: false,
      challengeRecorded: false,
    };
    // One exclusive transaction: submitting, paying, completing the quest, its
    // day and the challenge land together or not at all — a force close can
    // never split them.
    await writeDatabase((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        // Only the update that finds it still open changes a row: submitting twice is a no-op.
        const submitted = await txn.runAsync(
          `UPDATE exam_attempts
             SET answers_json = ?, submitted_at = ?, updated_at = ?, correct_count = ?, score = ?,
                 passed = ?
           WHERE id = ? AND submitted_at IS NULL`,
          [
            JSON.stringify(attempt.answers),
            attempt.submittedAt,
            attempt.submittedAt,
            attempt.correctCount,
            attempt.score,
            attempt.passed === null ? null : attempt.passed ? 1 : 0,
            attempt.id,
          ],
        );
        if (submitted.changes === 0) return;

        // The unique index on (ref_id) for 'examPass' keeps the reward to one per exam.
        const paid = reward
          ? await txn.runAsync(
              'INSERT OR IGNORE INTO xp_events (amount, reason, ref_id, created_at) VALUES (?, ?, ?, ?)',
              [reward.amount, reward.reason, reward.refId, reward.createdAt],
            )
          : null;
        const rewardGranted = (paid?.changes ?? 0) > 0;
        const earned = rewardGranted && reward ? reward.amount : 0;

        // The attempt is over: Home no longer shows it in progress.
        await txn.runAsync(
          'DELETE FROM quest_sessions WHERE quest_id = (SELECT quest_id FROM exam_attempts WHERE id = ?)',
          [attempt.id],
        );
        const existing = completion
          ? await txn.getFirstAsync<{ quest_id: string }>(
              'SELECT quest_id FROM quest_completions WHERE quest_id = ?',
              [completion.questId],
            )
          : null;
        let firstCompletion = false;
        let dayRecorded = false;
        let challengeRecorded = false;
        if (completion && existing) {
          // A retake: the quest keeps its first result; a first pass adds its reward.
          if (earned > 0) {
            await txn.runAsync(
              'UPDATE quest_completions SET xp_earned = xp_earned + ? WHERE quest_id = ?',
              [earned, completion.questId],
            );
          }
        } else if (completion) {
          await writeCompletion(txn, { ...completion, xpEarned: earned });
          await writeAnswers(txn, completion.questId, answers);
          firstCompletion = true;
          if (day) dayRecorded = await writeDayCompletion(txn, day);
          if (challenge) {
            challengeRecorded = await writeChallengeCompletion(txn, {
              ...challenge,
              xpEarned: earned,
            });
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
