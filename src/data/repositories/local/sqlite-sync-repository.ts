import { z } from 'zod';

import { placeholders, type LocalStore, type SqlExecutor } from '@/data/db/local-store';
import type {
  LegacyClaim,
  LegacyClaimInput,
  OutboxEntry,
  SyncApplied,
  SyncRepository,
  SyncState,
} from '@/data/repositories/types';
import {
  ExamAnswerSchema,
  ImportLegacyProgressPayloadSchema,
  ProgressMutationSchema,
  QuizAnswerSchema,
  type ImportLegacyProgressPayload,
  type ProgressMutation,
  type ProgressMutationOf,
  type ProgressSnapshot,
  type QuestAnswerInput,
  type SyncResponse,
  type Timestamp,
} from '@/schemas';

import { enqueueMutation } from './outbox';

/** The owner of progress from before accounts, and of everything in local mode. */
export const LOCAL_OWNER = 'local';

type OutboxRow = {
  mutation_id: string;
  mutation_json: string;
  status: 'pending' | 'rejected';
  attempt_count: number;
  last_attempt_at: string | null;
  error_code: string | null;
  error_message: string | null;
};

type ClaimRow = {
  status: 'claimed' | 'skipped' | 'none';
  owner_id: string | null;
  mutation_id: string | null;
  decided_at: string;
};

/** Tables whose rows may wait for the server, marked with the mutation they wait on. */
const TAGGED = [
  'quest_completions',
  'xp_events',
  'day_completions',
  'learned_words',
  'achievement_unlocks',
  'exam_attempts',
  'challenge_completion',
] as const;

const PENDING_IDS = `SELECT mutation_id FROM outbox WHERE owner_id = ? AND status = 'pending'`;

const DAILY_QUEST_TYPES = "('vocabulary', 'grammar', 'reading', 'review')";

const key = (...parts: (string | number | null)[]) => parts.join('\u0000');

/**
 * An account's side of sync, in SQLite: its outbox, the revision its copy
 * reflects, and the server's answers applied to its projection. Everything is
 * scoped by the account; nothing here ever reads or writes another owner's
 * rows — except, once, copying the device's own progress from before accounts
 * to the account that claims it.
 */
export class SqliteSyncRepository implements SyncRepository {
  constructor(
    private readonly store: LocalStore,
    readonly owner: string,
  ) {}

  async pending(limit: number): Promise<ProgressMutation[]> {
    const rows = await (
      await this.store.read()
    ).getAllAsync<OutboxRow>(
      `SELECT * FROM outbox WHERE owner_id = ? AND status = 'pending' ORDER BY seq ASC LIMIT ?`,
      [this.owner, limit],
    );
    const mutations: ProgressMutation[] = [];
    for (const row of rows) {
      const parsed = parseMutation(row.mutation_json);
      if (parsed) {
        mutations.push(parsed);
      } else {
        // Stored by an older app in a shape this one cannot send: set aside, not lost.
        await this.rejectLocally(row.mutation_id, 'UNREADABLE', 'This app cannot read the change.');
      }
    }
    return mutations;
  }

  async outbox(): Promise<OutboxEntry[]> {
    const rows = await (
      await this.store.read()
    ).getAllAsync<OutboxRow>('SELECT * FROM outbox WHERE owner_id = ? ORDER BY seq ASC', [
      this.owner,
    ]);
    return rows.map((row) => {
      const mutation = parseMutation(row.mutation_json);
      return {
        mutationId: row.mutation_id,
        type: mutation?.type ?? null,
        createdAt: mutation?.createdAt ?? null,
        status: row.status,
        attemptCount: row.attempt_count,
        lastAttemptAt: row.last_attempt_at,
        errorCode: row.error_code,
        errorMessage: row.error_message,
      };
    });
  }

  async counts(): Promise<{ pending: number; rejected: number }> {
    const rows = await (
      await this.store.read()
    ).getAllAsync<{ status: string; count: number }>(
      'SELECT status, COUNT(*) AS count FROM outbox WHERE owner_id = ? GROUP BY status',
      [this.owner],
    );
    const count = (status: string) => rows.find((row) => row.status === status)?.count ?? 0;
    return { pending: count('pending'), rejected: count('rejected') };
  }

  async state(): Promise<SyncState> {
    const row = await (
      await this.store.read()
    ).getFirstAsync<{ revision: number; synced_at: string }>(
      'SELECT revision, synced_at FROM sync_state WHERE owner_id = ?',
      [this.owner],
    );
    return { revision: row?.revision ?? 0, syncedAt: row?.synced_at ?? null };
  }

  async markAttempt(ids: readonly string[], at: Timestamp): Promise<void> {
    if (ids.length === 0) return;
    await this.store.write((db) =>
      db.runAsync(
        `UPDATE outbox SET attempt_count = attempt_count + 1, last_attempt_at = ?
         WHERE owner_id = ? AND mutation_id IN (${placeholders(ids.length)})`,
        [at, this.owner, ...ids],
      ),
    );
  }

  async rejectLocally(mutationId: string, code: string, message: string): Promise<void> {
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `UPDATE outbox SET status = 'rejected', error_code = ?, error_message = ?
           WHERE owner_id = ? AND mutation_id = ?`,
          [code, message, this.owner, mutationId],
        );
        await this.dropUnconfirmed(txn);
      }),
    );
  }

  /**
   * The server's answer, applied in one transaction: acknowledged mutations
   * leave the outbox, refused ones are marked, the projection becomes the
   * server's progress plus what still waits, and the revision moves on. Rows
   * are updated in place, never dropped and rewritten wholesale — what waits
   * for the server stays, and what the device alone keeps (celebrations,
   * quests in progress, open exam attempts) is never touched.
   */
  async apply(response: SyncResponse, at: Timestamp): Promise<SyncApplied> {
    let changed = false;
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        for (const result of response.results) {
          if (result.status === 'rejected') {
            await txn.runAsync(
              `UPDATE outbox SET status = 'rejected', error_code = ?, error_message = ?
               WHERE owner_id = ? AND mutation_id = ?`,
              [result.code ?? 'REJECTED', result.message ?? null, this.owner, result.mutationId],
            );
          } else {
            await txn.runAsync('DELETE FROM outbox WHERE owner_id = ? AND mutation_id = ?', [
              this.owner,
              result.mutationId,
            ]);
          }
        }
        if (response.progress) {
          await this.reconcile(txn, response.progress, at);
          changed = true;
        }
        if (await this.dropUnconfirmed(txn)) changed = true;
        await txn.runAsync(
          `INSERT INTO sync_state (owner_id, revision, synced_at) VALUES (?, ?, ?)
           ON CONFLICT(owner_id) DO UPDATE SET revision = excluded.revision, synced_at = excluded.synced_at`,
          [this.owner, response.revision, at],
        );
      }),
    );
    return { changed };
  }

  /** Whether the account has nothing on this device yet: no challenge, no progress, nothing waiting. */
  async isFresh(): Promise<boolean> {
    const db = await this.store.read();
    const row = await db.getFirstAsync<{ busy: number }>(
      `SELECT
         EXISTS (SELECT 1 FROM user_profile WHERE owner_id = ?1 AND onboarded_at IS NOT NULL)
         OR EXISTS (SELECT 1 FROM outbox WHERE owner_id = ?1)
         OR EXISTS (SELECT 1 FROM quest_completions WHERE owner_id = ?1)
         OR EXISTS (SELECT 1 FROM exam_attempts WHERE owner_id = ?1)
         AS busy`,
      [this.owner],
    );
    return row?.busy === 0;
  }

  async legacyClaim(): Promise<LegacyClaim | null> {
    const row = await (
      await this.store.read()
    ).getFirstAsync<ClaimRow>('SELECT * FROM legacy_claim WHERE slot = 1');
    return row
      ? {
          status: row.status,
          ownerId: row.owner_id,
          mutationId: row.mutation_id,
          decidedAt: row.decided_at,
        }
      : null;
  }

  /**
   * Claims the device's progress from before accounts for this account — once
   * per device, decided by whoever signs in first. The progress is copied (the
   * originals stay, unowned by any account) and marked as waiting for the
   * import mutation, which goes to the outbox in the same transaction. `null`
   * when there is nothing to claim or it was decided already.
   */
  async claimLegacy(input: LegacyClaimInput): Promise<ProgressMutation | null> {
    let claimed: ProgressMutation | null = null;
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        if (await txn.getFirstAsync('SELECT 1 FROM legacy_claim WHERE slot = 1')) return;
        const payload = await legacyPayload(txn, input);
        if (!payload) {
          await decide(txn, 'none', null, null, input.now);
          return;
        }
        const mutation: ProgressMutationOf<'importLegacyProgress'> = {
          id: input.mutationId,
          type: 'importLegacyProgress',
          createdAt: input.now,
          payload,
        };
        await copyLegacy(txn, this.owner, mutation.id);
        await enqueueMutation(txn, this.owner, mutation);
        await decide(txn, 'claimed', this.owner, mutation.id, input.now);
        claimed = mutation;
      }),
    );
    return claimed;
  }

  /** The first account here already had progress: the device's own is never merged into it. */
  async skipLegacy(now: Timestamp): Promise<void> {
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        if (await txn.getFirstAsync('SELECT 1 FROM legacy_claim WHERE slot = 1')) return;
        const exists = await txn.getFirstAsync(
          `SELECT 1 FROM user_profile WHERE owner_id = ? AND onboarded_at IS NOT NULL`,
          [LOCAL_OWNER],
        );
        await decide(txn, exists ? 'skipped' : 'none', exists ? this.owner : null, null, now);
      }),
    );
  }

  /** Rows marked with a mutation that no longer waits — refused, or done without making them — go. */
  private async dropUnconfirmed(txn: SqlExecutor): Promise<boolean> {
    const owner = this.owner;
    let dropped = 0;
    const gone = await txn.getAllAsync<{ quest_id: string }>(
      `SELECT quest_id FROM quest_completions WHERE owner_id = ? AND pending_mutation_id IS NOT NULL
         AND pending_mutation_id NOT IN (${PENDING_IDS})`,
      [owner, owner],
    );
    for (const { quest_id } of gone) {
      await txn.runAsync('DELETE FROM answers WHERE owner_id = ? AND quest_id = ?', [
        owner,
        quest_id,
      ]);
    }
    for (const table of TAGGED) {
      const result = await txn.runAsync(
        `DELETE FROM ${table} WHERE owner_id = ? AND pending_mutation_id IS NOT NULL
           AND pending_mutation_id NOT IN (${PENDING_IDS})`,
        [owner, owner],
      );
      dropped += result.changes;
    }
    // A start the server never made: onboarding again.
    const profile = await txn.runAsync(
      `UPDATE user_profile SET onboarded_at = NULL, pending_mutation_id = NULL
       WHERE owner_id = ? AND pending_mutation_id IS NOT NULL
         AND pending_mutation_id NOT IN (${PENDING_IDS})`,
      [owner, owner],
    );
    return dropped + profile.changes > 0;
  }

  /** Makes the confirmed part of the projection exactly the server's progress. */
  private async reconcile(txn: SqlExecutor, progress: ProgressSnapshot, at: Timestamp) {
    const owner = this.owner;

    // The challenge: started (and when) as the server says.
    const challenge = progress.challenge;
    if (challenge) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO user_profile (owner_id, display_name, challenge_start_date, created_at)
         VALUES (?, 'Explorer', ?, ?)`,
        [owner, challenge.startDate, at],
      );
      await txn.runAsync(
        `UPDATE user_profile
           SET challenge_start_date = ?, onboarded_at = COALESCE(onboarded_at, ?),
               pending_mutation_id = NULL
         WHERE owner_id = ?`,
        [challenge.startDate, challenge.startedAt, owner],
      );
    } else {
      await txn.runAsync(
        `UPDATE user_profile SET onboarded_at = NULL
         WHERE owner_id = ? AND pending_mutation_id IS NULL AND onboarded_at IS NOT NULL`,
        [owner],
      );
    }

    // Quests.
    for (const completion of progress.questCompletions) {
      await txn.runAsync(
        `INSERT INTO quest_completions
           (owner_id, quest_id, course_version, day, quest_type, score, correct_count, total_count,
            xp_earned, source, completed_at, pending_mutation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', ?, NULL)
         ON CONFLICT(owner_id, quest_id) DO UPDATE SET
           course_version = excluded.course_version, day = excluded.day,
           quest_type = excluded.quest_type, score = excluded.score,
           correct_count = excluded.correct_count, total_count = excluded.total_count,
           xp_earned = excluded.xp_earned, source = 'user', completed_at = excluded.completed_at,
           pending_mutation_id = NULL`,
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
          completion.completedAt,
        ],
      );
      // A finished quest is not in progress any more.
      await txn.runAsync('DELETE FROM quest_sessions WHERE owner_id = ? AND quest_id = ?', [
        owner,
        completion.questId,
      ]);
    }
    const quests = new Set(progress.questCompletions.map((completion) => completion.questId));
    const confirmedQuests = await txn.getAllAsync<{ quest_id: string }>(
      'SELECT quest_id FROM quest_completions WHERE owner_id = ? AND pending_mutation_id IS NULL',
      [owner],
    );
    for (const { quest_id } of confirmedQuests) {
      if (quests.has(quest_id)) continue;
      await txn.runAsync('DELETE FROM quest_completions WHERE owner_id = ? AND quest_id = ?', [
        owner,
        quest_id,
      ]);
      await txn.runAsync('DELETE FROM answers WHERE owner_id = ? AND quest_id = ?', [
        owner,
        quest_id,
      ]);
    }

    // Days. A day new to this device arrives celebrated: it was earned elsewhere.
    for (const day of progress.dayCompletions) {
      await txn.runAsync(
        `INSERT INTO day_completions
           (owner_id, day, completed_at, quest_count, xp_earned, streak_before, streak_after,
            is_perfect, celebrated_at, pending_mutation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(owner_id, day) DO UPDATE SET
           completed_at = excluded.completed_at, quest_count = excluded.quest_count,
           xp_earned = excluded.xp_earned, streak_before = excluded.streak_before,
           streak_after = excluded.streak_after, is_perfect = excluded.is_perfect,
           pending_mutation_id = NULL`,
        [
          owner,
          day.day,
          day.completedAt,
          day.questCount,
          day.xpEarned,
          day.streakBefore,
          day.streakAfter,
          day.isPerfect ? 1 : 0,
          at,
        ],
      );
    }
    await deleteConfirmedExcept(
      txn,
      owner,
      'day_completions',
      'day',
      new Set(progress.dayCompletions.map((day) => String(day.day))),
    );

    // Words.
    for (const word of progress.learnedWords) {
      await txn.runAsync(
        `INSERT INTO learned_words (owner_id, word_id, quest_id, learned_at, pending_mutation_id)
         VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT(owner_id, word_id, quest_id) DO UPDATE SET
           learned_at = excluded.learned_at, pending_mutation_id = NULL`,
        [owner, word.wordId, word.questId, word.learnedAt],
      );
    }
    const words = new Set(progress.learnedWords.map((word) => key(word.wordId, word.questId)));
    const confirmedWords = await txn.getAllAsync<{ word_id: string; quest_id: string }>(
      'SELECT word_id, quest_id FROM learned_words WHERE owner_id = ? AND pending_mutation_id IS NULL',
      [owner],
    );
    for (const word of confirmedWords) {
      if (words.has(key(word.word_id, word.quest_id))) continue;
      await txn.runAsync(
        'DELETE FROM learned_words WHERE owner_id = ? AND word_id = ? AND quest_id = ?',
        [owner, word.word_id, word.quest_id],
      );
    }

    // The XP ledger.
    for (const event of progress.xpEvents) {
      const updated = await txn.runAsync(
        `UPDATE xp_events SET amount = ?, created_at = ?, pending_mutation_id = NULL
         WHERE owner_id = ? AND reason = ? AND ref_id = ?`,
        [event.amount, event.createdAt, owner, event.reason, event.refId],
      );
      if (updated.changes === 0) {
        await txn.runAsync(
          `INSERT INTO xp_events (owner_id, amount, reason, ref_id, created_at, pending_mutation_id)
           VALUES (?, ?, ?, ?, ?, NULL)`,
          [owner, event.amount, event.reason, event.refId, event.createdAt],
        );
      }
    }
    const rewards = new Set(progress.xpEvents.map((event) => key(event.reason, event.refId)));
    const confirmedXp = await txn.getAllAsync<{
      id: number;
      reason: string;
      ref_id: string | null;
    }>(
      'SELECT id, reason, ref_id FROM xp_events WHERE owner_id = ? AND pending_mutation_id IS NULL',
      [owner],
    );
    for (const event of confirmedXp) {
      if (event.ref_id !== null && rewards.has(key(event.reason, event.ref_id))) continue;
      await txn.runAsync('DELETE FROM xp_events WHERE owner_id = ? AND id = ?', [owner, event.id]);
    }

    // Badges. One new to this device arrives celebrated, like a day.
    for (const unlock of progress.achievementUnlocks) {
      await txn.runAsync(
        `INSERT INTO achievement_unlocks
           (owner_id, achievement_id, unlocked_at, celebrated_at, pending_mutation_id)
         VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT(owner_id, achievement_id) DO UPDATE SET
           unlocked_at = excluded.unlocked_at, pending_mutation_id = NULL`,
        [owner, unlock.achievementId, unlock.unlockedAt, at],
      );
    }
    await deleteConfirmedExcept(
      txn,
      owner,
      'achievement_unlocks',
      'achievement_id',
      new Set(progress.achievementUnlocks.map((unlock) => unlock.achievementId)),
    );

    // Exam attempts handed in. Open ones are the device's alone.
    for (const attempt of progress.examAttempts) {
      await txn.runAsync(
        `INSERT INTO exam_attempts
           (owner_id, id, exam_id, quest_id, course_version, number, started_at, updated_at,
            current_index, answers_json, submitted_at, correct_count, total_count, score, passed,
            pending_mutation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(owner_id, id) DO UPDATE SET
           exam_id = excluded.exam_id, quest_id = excluded.quest_id,
           course_version = excluded.course_version, number = excluded.number,
           answers_json = excluded.answers_json, submitted_at = excluded.submitted_at,
           correct_count = excluded.correct_count, total_count = excluded.total_count,
           score = excluded.score, passed = excluded.passed, pending_mutation_id = NULL`,
        [
          owner,
          attempt.id,
          attempt.examId,
          attempt.questId,
          attempt.courseVersion,
          attempt.number,
          attempt.submittedAt,
          attempt.submittedAt,
          JSON.stringify(attempt.answers),
          attempt.submittedAt,
          attempt.correctCount,
          attempt.totalCount,
          attempt.score,
          attempt.passed ? 1 : 0,
        ],
      );
    }
    const attempts = new Set(progress.examAttempts.map((attempt) => attempt.id));
    const confirmedAttempts = await txn.getAllAsync<{ id: string }>(
      `SELECT id FROM exam_attempts
       WHERE owner_id = ? AND pending_mutation_id IS NULL AND submitted_at IS NOT NULL`,
      [owner],
    );
    for (const { id } of confirmedAttempts) {
      if (attempts.has(id)) continue;
      await txn.runAsync('DELETE FROM exam_attempts WHERE owner_id = ? AND id = ?', [owner, id]);
    }

    // The summit.
    const summit = progress.challengeCompletion;
    if (summit) {
      await txn.runAsync(
        `INSERT INTO challenge_completion
           (owner_id, completed_at, final_attempt_id, correct_count, total_count, score, is_perfect,
            xp_earned, celebrated_at, pending_mutation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(owner_id) DO UPDATE SET
           completed_at = excluded.completed_at, final_attempt_id = excluded.final_attempt_id,
           correct_count = excluded.correct_count, total_count = excluded.total_count,
           score = excluded.score, is_perfect = excluded.is_perfect, xp_earned = excluded.xp_earned,
           pending_mutation_id = NULL`,
        [
          owner,
          summit.completedAt,
          summit.finalAttemptId,
          summit.correctCount,
          summit.totalCount,
          summit.score,
          summit.isPerfect ? 1 : 0,
          summit.xpEarned,
          at,
        ],
      );
    } else {
      await txn.runAsync(
        'DELETE FROM challenge_completion WHERE owner_id = ? AND pending_mutation_id IS NULL',
        [owner],
      );
    }
  }
}

function parseMutation(json: string): ProgressMutation | null {
  try {
    const parsed = ProgressMutationSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Deletes the owner's confirmed rows whose key the server does not have. */
async function deleteConfirmedExcept(
  txn: SqlExecutor,
  owner: string,
  table: 'day_completions' | 'achievement_unlocks',
  column: 'day' | 'achievement_id',
  keep: ReadonlySet<string>,
) {
  const rows = await txn.getAllAsync<Record<string, string | number>>(
    `SELECT ${column} AS value FROM ${table} WHERE owner_id = ? AND pending_mutation_id IS NULL`,
    [owner],
  );
  for (const row of rows) {
    const value = row['value'];
    if (value === undefined || keep.has(String(value))) continue;
    await txn.runAsync(`DELETE FROM ${table} WHERE owner_id = ? AND ${column} = ?`, [owner, value]);
  }
}

async function decide(
  txn: SqlExecutor,
  status: LegacyClaim['status'],
  owner: string | null,
  mutationId: string | null,
  at: Timestamp,
) {
  await txn.runAsync(
    `INSERT OR IGNORE INTO legacy_claim (slot, status, owner_id, mutation_id, decided_at)
     VALUES (1, ?, ?, ?, ?)`,
    [status, owner, mutationId, at],
  );
}

/** The option a stored single-choice answer picked; `null` for anything else. */
function storedChoice(json: string): string | null {
  try {
    const parsed = QuizAnswerSchema.safeParse(JSON.parse(json));
    return parsed.success && parsed.data.kind === 'singleChoice' ? parsed.data.optionId : null;
  } catch {
    return null;
  }
}

/**
 * What the server needs to rebuild the device's progress from before
 * accounts: the start and what was played — answers, not results. Quests
 * finished by development shortcuts have no answers and are left out.
 */
async function legacyPayload(
  txn: SqlExecutor,
  input: LegacyClaimInput,
): Promise<ImportLegacyProgressPayload | null> {
  const profile = await txn.getFirstAsync<{ challenge_start_date: string }>(
    'SELECT challenge_start_date FROM user_profile WHERE owner_id = ? AND onboarded_at IS NOT NULL',
    [LOCAL_OWNER],
  );
  if (!profile) return null;

  const completions = await txn.getAllAsync<{ quest_id: string; completed_at: string }>(
    `SELECT quest_id, completed_at FROM quest_completions
     WHERE owner_id = ? AND source = 'user' AND quest_type IN ${DAILY_QUEST_TYPES}
     ORDER BY day ASC, completed_at ASC`,
    [LOCAL_OWNER],
  );
  const quests: ImportLegacyProgressPayload['quests'] = [];
  for (const completion of completions) {
    const rows = await txn.getAllAsync<{ question_id: string; answer_json: string }>(
      'SELECT question_id, answer_json FROM answers WHERE owner_id = ? AND quest_id = ? ORDER BY id',
      [LOCAL_OWNER, completion.quest_id],
    );
    const answers: QuestAnswerInput[] = rows.flatMap((row) => {
      const optionId = storedChoice(row.answer_json);
      return optionId === null ? [] : [{ exerciseId: row.question_id, optionId }];
    });
    if (answers.length > 0) {
      quests.push({ questId: completion.quest_id, answers, completedAt: completion.completed_at });
    }
  }

  const attempts = await txn.getAllAsync<{
    id: string;
    quest_id: string;
    answers_json: string;
    submitted_at: string;
  }>(
    `SELECT id, quest_id, answers_json, submitted_at FROM exam_attempts
     WHERE owner_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at ASC`,
    [LOCAL_OWNER],
  );
  const exams = attempts.flatMap((attempt) => {
    try {
      const answers = z.array(ExamAnswerSchema).parse(JSON.parse(attempt.answers_json));
      return [
        {
          questId: attempt.quest_id,
          attemptId: attempt.id,
          answers,
          submittedAt: attempt.submitted_at,
        },
      ];
    } catch {
      return [];
    }
  });

  const payload = ImportLegacyProgressPayloadSchema.safeParse({
    courseId: input.courseId,
    courseVersion: input.courseVersion,
    startDate: profile.challenge_start_date,
    timeZone: input.timeZone,
    quests: quests.slice(0, 400),
    exams: exams.slice(-200),
  });
  return payload.success ? payload.data : null;
}

/**
 * Copies the device's own progress to the account, marked as waiting for the
 * import: the account sees it at once, and the server's answer replaces it
 * with what the server made of it. The originals stay where they are.
 */
async function copyLegacy(txn: SqlExecutor, owner: string, tag: string) {
  const from = LOCAL_OWNER;
  await txn.runAsync(
    `UPDATE user_profile SET
       display_name = (SELECT display_name FROM user_profile WHERE owner_id = ?2),
       goal = (SELECT goal FROM user_profile WHERE owner_id = ?2),
       challenge_start_date = (SELECT challenge_start_date FROM user_profile WHERE owner_id = ?2),
       onboarded_at = (SELECT onboarded_at FROM user_profile WHERE owner_id = ?2),
       pending_mutation_id = ?3
     WHERE owner_id = ?1 AND onboarded_at IS NULL`,
    [owner, from, tag],
  );
  const copies: [string, string][] = [
    [
      'quest_completions',
      'quest_id, course_version, day, quest_type, score, correct_count, total_count, xp_earned, source, completed_at',
    ],
    ['xp_events', 'amount, reason, ref_id, created_at'],
    [
      'day_completions',
      'day, completed_at, quest_count, xp_earned, streak_before, streak_after, is_perfect, celebrated_at',
    ],
    ['learned_words', 'word_id, quest_id, learned_at'],
    ['achievement_unlocks', 'achievement_id, unlocked_at, celebrated_at'],
    [
      'challenge_completion',
      'completed_at, final_attempt_id, correct_count, total_count, score, is_perfect, xp_earned, celebrated_at',
    ],
  ];
  for (const [table, columns] of copies) {
    await txn.runAsync(
      `INSERT OR IGNORE INTO ${table} (owner_id, ${columns}, pending_mutation_id)
       SELECT ?, ${columns}, ? FROM ${table} WHERE owner_id = ?`,
      [owner, tag, from],
    );
  }
  const attemptColumns =
    'id, exam_id, quest_id, course_version, number, started_at, updated_at, current_index, answers_json, submitted_at, correct_count, total_count, score, passed';
  // Handed-in attempts wait for the server; an open one is the device's, as ever.
  await txn.runAsync(
    `INSERT OR IGNORE INTO exam_attempts (owner_id, ${attemptColumns}, pending_mutation_id)
     SELECT ?, ${attemptColumns}, CASE WHEN submitted_at IS NULL THEN NULL ELSE ? END
     FROM exam_attempts WHERE owner_id = ?`,
    [owner, tag, from],
  );
  await txn.runAsync(
    `INSERT INTO answers (owner_id, quest_id, question_id, answer_json, is_correct, answered_at)
     SELECT ?, quest_id, question_id, answer_json, is_correct, answered_at FROM answers
     WHERE owner_id = ?`,
    [owner, from],
  );
  await txn.runAsync(
    `INSERT OR IGNORE INTO quest_sessions (owner_id, quest_id, started_at, updated_at, progress, state_json)
     SELECT ?, quest_id, started_at, updated_at, progress, state_json FROM quest_sessions
     WHERE owner_id = ?`,
    [owner, from],
  );
}
