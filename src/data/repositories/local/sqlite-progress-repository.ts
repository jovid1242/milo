import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase, writeDatabase } from '@/data/db/database';
import type { ProgressRepository } from '@/data/repositories/types';
import {
  DayCompletionSchema,
  QuestCompletionSchema,
  QuestSessionSchema,
  type AnswerRecord,
  type DayCompletion,
  type DayNumber,
  type QuestCompletion,
  type QuestSession,
  type Timestamp,
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
  state_json: string | null;
};

type DayRow = {
  day: number;
  completed_at: string;
  quest_count: number;
  xp_earned: number;
  streak_before: number;
  streak_after: number;
  is_perfect: number;
  celebrated_at: string | null;
};

const mapDay = (row: DayRow): DayCompletion =>
  DayCompletionSchema.parse({
    day: row.day,
    completedAt: row.completed_at,
    questCount: row.quest_count,
    xpEarned: row.xp_earned,
    streakBefore: row.streak_before,
    streakAfter: row.streak_after,
    isPerfect: row.is_perfect === 1,
    celebratedAt: row.celebrated_at,
  });

/** Shared with the dev repository, which backfills finished days in bulk. */
export async function writeDayCompletion(db: SQLiteDatabase, record: DayCompletion) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO day_completions
       (day, completed_at, quest_count, xp_earned, streak_before, streak_after, is_perfect, celebrated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.day,
      record.completedAt,
      record.questCount,
      record.xpEarned,
      record.streakBefore,
      record.streakAfter,
      record.isPerfect ? 1 : 0,
      record.celebratedAt,
    ],
  );
  return result.changes > 0;
}

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

/** Unreadable saved state is dropped: the quest then simply starts over. */
function parseState(json: string | null): unknown {
  if (json === null) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const mapSession = (row: SessionRow): QuestSession =>
  QuestSessionSchema.parse({
    questId: row.quest_id,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    progress: row.progress,
    state: parseState(row.state_json),
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

/** `OR IGNORE`: a second XP event for the same quest is refused by a unique index. */
export async function writeXpEvent(db: SQLiteDatabase, event: XpEvent) {
  await db.runAsync(
    'INSERT OR IGNORE INTO xp_events (amount, reason, ref_id, created_at) VALUES (?, ?, ?, ?)',
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

  async recordFirstCompletion(
    completion: QuestCompletion,
    answers: readonly AnswerRecord[],
    xp: XpEvent | null,
  ): Promise<boolean> {
    let recorded = false;
    // Exclusive: the "already completed?" check and the writes cannot interleave
    // with another completion of the same quest (e.g. a double tap).
    await writeDatabase((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('DELETE FROM quest_sessions WHERE quest_id = ?', [completion.questId]);
        const existing = await txn.getFirstAsync<{ quest_id: string }>(
          'SELECT quest_id FROM quest_completions WHERE quest_id = ?',
          [completion.questId],
        );
        if (existing) return;

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
        if (xp) await writeXpEvent(txn, xp);
        recorded = true;
      }),
    );
    return recorded;
  }

  async getQuestSessions(): Promise<QuestSession[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<SessionRow>('SELECT * FROM quest_sessions');
    return rows.map(mapSession);
  }

  async saveQuestSession(session: QuestSession): Promise<void> {
    await writeDatabase((db) =>
      db.runAsync(
        `INSERT INTO quest_sessions (quest_id, started_at, updated_at, progress, state_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(quest_id) DO UPDATE SET
         updated_at = excluded.updated_at,
         progress = excluded.progress,
         state_json = excluded.state_json`,
        [
          session.questId,
          session.startedAt,
          session.updatedAt,
          session.progress,
          session.state === null ? null : JSON.stringify(session.state),
        ],
      ),
    );
  }

  async deleteQuestSession(questId: string): Promise<void> {
    await writeDatabase((db) =>
      db.runAsync('DELETE FROM quest_sessions WHERE quest_id = ?', [questId]),
    );
  }

  async addXpEvent(event: XpEvent): Promise<void> {
    await writeDatabase((db) => writeXpEvent(db, event));
  }

  async recordDayCompletion(record: DayCompletion): Promise<boolean> {
    return writeDatabase((db) => writeDayCompletion(db, record));
  }

  async getDayCompletion(day: DayNumber): Promise<DayCompletion | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<DayRow>('SELECT * FROM day_completions WHERE day = ?', [
      day,
    ]);
    return row ? mapDay(row) : null;
  }

  async getDayCompletions(): Promise<DayCompletion[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<DayRow>('SELECT * FROM day_completions ORDER BY day ASC');
    return rows.map(mapDay);
  }

  async markDayCelebrated(day: DayNumber, at: Timestamp): Promise<boolean> {
    // Atomic claim: only the update that finds it still uncelebrated changes a row.
    const result = await writeDatabase((db) =>
      db.runAsync(
        'UPDATE day_completions SET celebrated_at = ? WHERE day = ? AND celebrated_at IS NULL',
        [at, day],
      ),
    );
    return result.changes > 0;
  }

  async deleteXpEvents(reason: XpEventReason): Promise<void> {
    await writeDatabase((db) => db.runAsync('DELETE FROM xp_events WHERE reason = ?', [reason]));
  }

  async deleteCompletions(questIds: readonly string[]): Promise<void> {
    if (questIds.length === 0) return;
    const list = placeholders(questIds.length);
    const params = [...questIds];
    await writeDatabase((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        // A day without all its quests is not finished any more.
        await txn.runAsync(
          `DELETE FROM day_completions WHERE day IN
           (SELECT day FROM quest_completions WHERE quest_id IN (${list}))`,
          params,
        );
        await txn.runAsync(`DELETE FROM quest_completions WHERE quest_id IN (${list})`, params);
        await txn.runAsync(`DELETE FROM answers WHERE quest_id IN (${list})`, params);
        await txn.runAsync(`DELETE FROM quest_sessions WHERE quest_id IN (${list})`, params);
        await txn.runAsync(
          `DELETE FROM xp_events WHERE reason = 'quest' AND ref_id IN (${list})`,
          params,
        );
      }),
    );
  }

  async resetProgress(): Promise<void> {
    await writeDatabase((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.execAsync(
          'DELETE FROM quest_completions; DELETE FROM answers; DELETE FROM quest_sessions; DELETE FROM xp_events; DELETE FROM day_completions;',
        );
      }),
    );
  }
}
