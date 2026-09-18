import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/data/db/database';
import type { ProgressRepository } from '@/data/repositories/types';
import {
  QuestCompletionSchema,
  QuestSessionSchema,
  type AnswerRecord,
  type DayNumber,
  type QuestCompletion,
  type QuestSession,
  type XpEvent,
  type XpEventReason,
} from '@/schemas';

type CompletionRow = {
  quest_id: string;
  day: number;
  quest_type: string;
  score: number;
  correct_count: number;
  total_count: number;
  xp_earned: number;
  source: string;
  completed_at: string;
};

type SessionRow = {
  quest_id: string;
  started_at: string;
  updated_at: string;
  progress: number;
};

const mapCompletion = (row: CompletionRow): QuestCompletion =>
  QuestCompletionSchema.parse({
    questId: row.quest_id,
    day: row.day,
    questType: row.quest_type,
    score: row.score,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    xpEarned: row.xp_earned,
    source: row.source,
    completedAt: row.completed_at,
  });

const mapSession = (row: SessionRow): QuestSession =>
  QuestSessionSchema.parse({
    questId: row.quest_id,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    progress: row.progress,
  });

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

/** Shared with the dev repository, which seeds many rows in one transaction. */
export async function writeCompletion(db: SQLiteDatabase, completion: QuestCompletion) {
  await db.runAsync(
    `INSERT INTO quest_completions
       (quest_id, day, quest_type, score, correct_count, total_count, xp_earned, source, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(quest_id) DO UPDATE SET
       score = excluded.score,
       correct_count = excluded.correct_count,
       total_count = excluded.total_count,
       xp_earned = excluded.xp_earned,
       source = excluded.source,
       completed_at = excluded.completed_at`,
    [
      completion.questId,
      completion.day,
      completion.questType,
      completion.score,
      completion.correctCount,
      completion.totalCount,
      completion.xpEarned,
      completion.source,
      completion.completedAt,
    ],
  );
  await db.runAsync('DELETE FROM quest_sessions WHERE quest_id = ?', [completion.questId]);
}

export async function writeXpEvent(db: SQLiteDatabase, event: XpEvent) {
  await db.runAsync(
    'INSERT INTO xp_events (amount, reason, ref_id, created_at) VALUES (?, ?, ?, ?)',
    [event.amount, event.reason, event.refId, event.createdAt],
  );
}

export class SqliteProgressRepository implements ProgressRepository {
  async getCompletions(): Promise<QuestCompletion[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<CompletionRow>(
      'SELECT * FROM quest_completions ORDER BY day ASC, completed_at ASC',
    );
    return rows.map(mapCompletion);
  }

  async getCompletionsForDays(days: readonly DayNumber[]): Promise<QuestCompletion[]> {
    if (days.length === 0) return [];
    const db = await getDatabase();
    const rows = await db.getAllAsync<CompletionRow>(
      `SELECT * FROM quest_completions WHERE day IN (${placeholders(days.length)}) ORDER BY day ASC`,
      [...days],
    );
    return rows.map(mapCompletion);
  }

  async getTotalXp(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events',
    );
    return row?.total ?? 0;
  }

  async saveQuestCompletion(
    completion: QuestCompletion,
    answers: readonly AnswerRecord[],
  ): Promise<void> {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await writeCompletion(txn, completion);
      await txn.runAsync('DELETE FROM answers WHERE quest_id = ?', [completion.questId]);
      for (const answer of answers) {
        await txn.runAsync(
          `INSERT INTO answers (quest_id, question_id, answer_json, is_correct, answered_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            answer.questId,
            answer.questionId,
            JSON.stringify(answer.answer),
            answer.isCorrect ? 1 : 0,
            answer.answeredAt,
          ],
        );
      }
    });
  }

  async getQuestSessions(): Promise<QuestSession[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<SessionRow>('SELECT * FROM quest_sessions');
    return rows.map(mapSession);
  }

  async saveQuestSession(session: QuestSession): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO quest_sessions (quest_id, started_at, updated_at, progress)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(quest_id) DO UPDATE SET
         updated_at = excluded.updated_at,
         progress = excluded.progress`,
      [session.questId, session.startedAt, session.updatedAt, session.progress],
    );
  }

  async addXpEvent(event: XpEvent): Promise<void> {
    const db = await getDatabase();
    await writeXpEvent(db, event);
  }

  async deleteXpEvents(reason: XpEventReason): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM xp_events WHERE reason = ?', [reason]);
  }

  async deleteCompletions(questIds: readonly string[]): Promise<void> {
    if (questIds.length === 0) return;
    const db = await getDatabase();
    const list = placeholders(questIds.length);
    const params = [...questIds];
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(`DELETE FROM quest_completions WHERE quest_id IN (${list})`, params);
      await txn.runAsync(`DELETE FROM answers WHERE quest_id IN (${list})`, params);
      await txn.runAsync(`DELETE FROM quest_sessions WHERE quest_id IN (${list})`, params);
      await txn.runAsync(
        `DELETE FROM xp_events WHERE reason = 'quest' AND ref_id IN (${list})`,
        params,
      );
    });
  }

  async resetProgress(): Promise<void> {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(
        'DELETE FROM quest_completions; DELETE FROM answers; DELETE FROM quest_sessions; DELETE FROM xp_events;',
      );
    });
  }
}
