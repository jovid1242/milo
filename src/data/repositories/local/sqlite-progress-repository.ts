import { placeholders, type LocalStore, type SqlExecutor } from '@/data/db/local-store';
import type { ProgressRepository } from '@/data/repositories/types';
import {
  ChallengeCompletionSchema,
  DayCompletionSchema,
  QuestCompletionSchema,
  QuestSessionSchema,
  type AnswerRecord,
  type ChallengeCompletion,
  type DayCompletion,
  type DayNumber,
  type LearnedWord,
  type ProgressMutation,
  type QuestCompletion,
  type QuestSession,
  type Timestamp,
  type XpEvent,
  type XpEventReason,
} from '@/schemas';

import { enqueueMutation, pendingTag } from './outbox';

type CompletionRow = {
  quest_id: string;
  course_version: number;
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

type ChallengeRow = {
  completed_at: string;
  final_attempt_id: string;
  correct_count: number;
  total_count: number;
  score: number;
  is_perfect: number;
  xp_earned: number;
  celebrated_at: string | null;
};

export const mapDay = (row: DayRow): DayCompletion =>
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

const mapChallenge = (row: ChallengeRow): ChallengeCompletion =>
  ChallengeCompletionSchema.parse({
    completedAt: row.completed_at,
    finalAttemptId: row.final_attempt_id,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    score: row.score,
    isPerfect: row.is_perfect === 1,
    xpEarned: row.xp_earned,
    celebratedAt: row.celebrated_at,
  });

const mapCompletion = (row: CompletionRow): QuestCompletion =>
  QuestCompletionSchema.parse({
    questId: row.quest_id,
    courseVersion: row.course_version,
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

// The writes below are shared with the exam and dev repositories and with
// sync. Each takes its owner; `tag` marks a row the server has not confirmed.

export async function writeLearnedWords(
  db: SqlExecutor,
  owner: string,
  words: readonly LearnedWord[],
  tag: string | null,
) {
  for (const word of words) {
    await db.runAsync(
      `INSERT OR IGNORE INTO learned_words (owner_id, word_id, quest_id, learned_at, pending_mutation_id)
       VALUES (?, ?, ?, ?, ?)`,
      [owner, word.wordId, word.questId, word.learnedAt, tag],
    );
  }
}

/** A finished day, once: `false` when the day was recorded already. */
export async function writeDayCompletion(
  db: SqlExecutor,
  owner: string,
  record: DayCompletion,
  tag: string | null,
) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO day_completions
       (owner_id, day, completed_at, quest_count, xp_earned, streak_before, streak_after,
        is_perfect, celebrated_at, pending_mutation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      owner,
      record.day,
      record.completedAt,
      record.questCount,
      record.xpEarned,
      record.streakBefore,
      record.streakAfter,
      record.isPerfect ? 1 : 0,
      record.celebratedAt,
      tag,
    ],
  );
  return result.changes > 0;
}

/** The owner's one summit; `false` if it exists. */
export async function writeChallengeCompletion(
  db: SqlExecutor,
  owner: string,
  record: ChallengeCompletion,
  tag: string | null,
) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO challenge_completion
       (owner_id, completed_at, final_attempt_id, correct_count, total_count, score, is_perfect,
        xp_earned, celebrated_at, pending_mutation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      owner,
      record.completedAt,
      record.finalAttemptId,
      record.correctCount,
      record.totalCount,
      record.score,
      record.isPerfect ? 1 : 0,
      record.xpEarned,
      record.celebratedAt,
      tag,
    ],
  );
  return result.changes > 0;
}

export async function writeCompletion(
  db: SqlExecutor,
  owner: string,
  completion: QuestCompletion,
  tag: string | null,
) {
  await db.runAsync(
    `INSERT INTO quest_completions
       (owner_id, quest_id, course_version, day, quest_type, score, correct_count, total_count,
        xp_earned, source, completed_at, pending_mutation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_id, quest_id) DO UPDATE SET
       course_version = excluded.course_version,
       score = excluded.score,
       correct_count = excluded.correct_count,
       total_count = excluded.total_count,
       xp_earned = excluded.xp_earned,
       source = excluded.source,
       completed_at = excluded.completed_at,
       pending_mutation_id = excluded.pending_mutation_id`,
    [
      owner,
      completion.questId,
      completion.courseVersion,
      completion.day,
      completion.questType,
      completion.score,
      completion.correctCount,
      completion.totalCount,
      completion.xpEarned,
      completion.source,
      completion.completedAt,
      tag,
    ],
  );
  await db.runAsync('DELETE FROM quest_sessions WHERE owner_id = ? AND quest_id = ?', [
    owner,
    completion.questId,
  ]);
}

/** Replaces a quest's stored answers. */
export async function writeAnswers(
  db: SqlExecutor,
  owner: string,
  questId: string,
  answers: readonly AnswerRecord[],
) {
  await db.runAsync('DELETE FROM answers WHERE owner_id = ? AND quest_id = ?', [owner, questId]);
  for (const answer of answers) {
    await db.runAsync(
      `INSERT INTO answers (owner_id, quest_id, question_id, answer_json, is_correct, answered_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        owner,
        answer.questId,
        answer.questionId,
        JSON.stringify(answer.answer),
        answer.isCorrect ? 1 : 0,
        answer.answeredAt,
      ],
    );
  }
}

/** `OR IGNORE`: a reward paid already (a quest's, an exam's, a badge's) is refused by a unique index. */
export async function writeXpEvent(
  db: SqlExecutor,
  owner: string,
  event: XpEvent,
  tag: string | null,
) {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO xp_events (owner_id, amount, reason, ref_id, created_at, pending_mutation_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [owner, event.amount, event.reason, event.refId, event.createdAt, tag],
  );
  return result.changes > 0;
}

/**
 * One owner's progress in SQLite: the device's own in local mode, or an
 * account's projection — what the server confirmed plus what waits in its
 * outbox. Every statement is scoped by the owner.
 */
export class SqliteProgressRepository implements ProgressRepository {
  constructor(
    private readonly store: LocalStore,
    private readonly owner: string,
  ) {}

  async getCompletions(): Promise<QuestCompletion[]> {
    const db = await this.store.read();
    const rows = await db.getAllAsync<CompletionRow>(
      'SELECT * FROM quest_completions WHERE owner_id = ? ORDER BY day ASC, completed_at ASC',
      [this.owner],
    );
    return rows.map(mapCompletion);
  }

  async getCompletionsForDays(days: readonly DayNumber[]): Promise<QuestCompletion[]> {
    if (days.length === 0) return [];
    const db = await this.store.read();
    const rows = await db.getAllAsync<CompletionRow>(
      `SELECT * FROM quest_completions WHERE owner_id = ? AND day IN (${placeholders(days.length)})
       ORDER BY day ASC`,
      [this.owner, ...days],
    );
    return rows.map(mapCompletion);
  }

  async getTotalXp(): Promise<number> {
    const db = await this.store.read();
    const row = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events WHERE owner_id = ?',
      [this.owner],
    );
    return row?.total ?? 0;
  }

  async recordFirstCompletion(
    completion: QuestCompletion,
    answers: readonly AnswerRecord[],
    xp: XpEvent | null,
    mutation: ProgressMutation | null = null,
  ): Promise<boolean> {
    let recorded = false;
    const { owner } = this;
    // Exclusive: the "already completed?" check and the writes cannot interleave
    // with another completion of the same quest (e.g. a double tap). The outbox
    // entry lands with the progress it made, or neither does.
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('DELETE FROM quest_sessions WHERE owner_id = ? AND quest_id = ?', [
          owner,
          completion.questId,
        ]);
        const existing = await txn.getFirstAsync<{ quest_id: string }>(
          'SELECT quest_id FROM quest_completions WHERE owner_id = ? AND quest_id = ?',
          [owner, completion.questId],
        );
        if (existing) return;

        const tag = mutation?.id ?? null;
        await writeCompletion(txn, owner, completion, tag);
        await writeAnswers(txn, owner, completion.questId, answers);
        if (xp) await writeXpEvent(txn, owner, xp, tag);
        if (mutation) await enqueueMutation(txn, owner, mutation);
        recorded = true;
      }),
    );
    return recorded;
  }

  async getQuestSessions(): Promise<QuestSession[]> {
    const db = await this.store.read();
    const rows = await db.getAllAsync<SessionRow>(
      'SELECT * FROM quest_sessions WHERE owner_id = ?',
      [this.owner],
    );
    return rows.map(mapSession);
  }

  async saveQuestSession(session: QuestSession): Promise<void> {
    await this.store.write((db) =>
      db.runAsync(
        `INSERT INTO quest_sessions (owner_id, quest_id, started_at, updated_at, progress, state_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(owner_id, quest_id) DO UPDATE SET
           updated_at = excluded.updated_at,
           progress = excluded.progress,
           state_json = excluded.state_json`,
        [
          this.owner,
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
    await this.store.write((db) =>
      db.runAsync('DELETE FROM quest_sessions WHERE owner_id = ? AND quest_id = ?', [
        this.owner,
        questId,
      ]),
    );
  }

  async addXpEvent(event: XpEvent): Promise<void> {
    await this.store.write(async (db) => {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await writeXpEvent(txn, this.owner, event, await pendingTag(txn, this.owner));
      });
    });
  }

  async recordDayCompletion(record: DayCompletion): Promise<boolean> {
    let recorded = false;
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        recorded = await writeDayCompletion(
          txn,
          this.owner,
          record,
          await pendingTag(txn, this.owner),
        );
      }),
    );
    return recorded;
  }

  async getDayCompletion(day: DayNumber): Promise<DayCompletion | null> {
    const db = await this.store.read();
    const row = await db.getFirstAsync<DayRow>(
      'SELECT * FROM day_completions WHERE owner_id = ? AND day = ?',
      [this.owner, day],
    );
    return row ? mapDay(row) : null;
  }

  async getDayCompletions(): Promise<DayCompletion[]> {
    const db = await this.store.read();
    const rows = await db.getAllAsync<DayRow>(
      'SELECT * FROM day_completions WHERE owner_id = ? ORDER BY day ASC',
      [this.owner],
    );
    return rows.map(mapDay);
  }

  async markDayCelebrated(day: DayNumber, at: Timestamp): Promise<boolean> {
    // Atomic claim: only the update that finds it still uncelebrated changes a row.
    const result = await this.store.write((db) =>
      db.runAsync(
        `UPDATE day_completions SET celebrated_at = ?
         WHERE owner_id = ? AND day = ? AND celebrated_at IS NULL`,
        [at, this.owner, day],
      ),
    );
    return result.changes > 0;
  }

  async getChallengeCompletion(): Promise<ChallengeCompletion | null> {
    const db = await this.store.read();
    const row = await db.getFirstAsync<ChallengeRow>(
      'SELECT * FROM challenge_completion WHERE owner_id = ?',
      [this.owner],
    );
    return row ? mapChallenge(row) : null;
  }

  async markChallengeCelebrated(at: Timestamp): Promise<boolean> {
    const result = await this.store.write((db) =>
      db.runAsync(
        'UPDATE challenge_completion SET celebrated_at = ? WHERE owner_id = ? AND celebrated_at IS NULL',
        [at, this.owner],
      ),
    );
    return result.changes > 0;
  }

  async recordLearnedWords(words: readonly LearnedWord[]): Promise<void> {
    if (words.length === 0) return;
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) =>
        writeLearnedWords(txn, this.owner, words, await pendingTag(txn, this.owner)),
      ),
    );
  }

  async countLearnedWords(): Promise<number> {
    const db = await this.store.read();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(DISTINCT word_id) AS count FROM learned_words WHERE owner_id = ?',
      [this.owner],
    );
    return row?.count ?? 0;
  }

  async deleteXpEvents(reason: XpEventReason): Promise<void> {
    await this.store.write((db) =>
      db.runAsync('DELETE FROM xp_events WHERE owner_id = ? AND reason = ?', [this.owner, reason]),
    );
  }

  async deleteCompletions(questIds: readonly string[]): Promise<void> {
    if (questIds.length === 0) return;
    const list = placeholders(questIds.length);
    const params = [this.owner, ...questIds];
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        // Without its Final Battle, the challenge is not finished any more.
        await txn.runAsync(
          `DELETE FROM challenge_completion WHERE owner_id = ? AND EXISTS
           (SELECT 1 FROM quest_completions WHERE owner_id = ? AND quest_type = 'finalBattle'
              AND quest_id IN (${list}))`,
          [this.owner, ...params],
        );
        // A day without all its quests is not finished any more.
        await txn.runAsync(
          `DELETE FROM day_completions WHERE owner_id = ? AND day IN
           (SELECT day FROM quest_completions WHERE owner_id = ? AND quest_id IN (${list}))`,
          [this.owner, ...params],
        );
        await txn.runAsync(
          `DELETE FROM quest_completions WHERE owner_id = ? AND quest_id IN (${list})`,
          params,
        );
        await txn.runAsync(
          `DELETE FROM answers WHERE owner_id = ? AND quest_id IN (${list})`,
          params,
        );
        await txn.runAsync(
          `DELETE FROM learned_words WHERE owner_id = ? AND quest_id IN (${list})`,
          params,
        );
        // The pass reward belongs to the exam: reset with its attempts.
        await txn.runAsync(
          `DELETE FROM xp_events WHERE owner_id = ? AND reason = 'examPass' AND ref_id IN
             (SELECT exam_id FROM exam_attempts WHERE owner_id = ? AND quest_id IN (${list}))`,
          [this.owner, ...params],
        );
        await txn.runAsync(
          `DELETE FROM exam_attempts WHERE owner_id = ? AND quest_id IN (${list})`,
          params,
        );
        await txn.runAsync(
          `DELETE FROM quest_sessions WHERE owner_id = ? AND quest_id IN (${list})`,
          params,
        );
        await txn.runAsync(
          `DELETE FROM xp_events WHERE owner_id = ? AND reason = 'quest' AND ref_id IN (${list})`,
          params,
        );
      }),
    );
  }

  async resetProgress(): Promise<void> {
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        for (const table of [
          'quest_completions',
          'answers',
          'quest_sessions',
          'xp_events',
          'day_completions',
          'learned_words',
          'exam_attempts',
          'challenge_completion',
        ]) {
          await txn.runAsync(`DELETE FROM ${table} WHERE owner_id = ?`, [this.owner]);
        }
      }),
    );
  }
}
