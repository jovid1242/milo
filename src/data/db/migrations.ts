import { logger } from '@/lib/logger';

import type { SqlDatabase, SqlExecutor } from './local-store';

/**
 * Word ids as they were before the course had its id convention: the words of
 * Days 1 and 89, by the quest that taught them. Frozen here on purpose — a
 * migration must never read content that keeps changing after it is written.
 */
const LEGACY_WORDS: Readonly<Record<string, readonly string[]>> = {
  'd001-vocabulary': ['journey', 'habit', 'goal', 'improve', 'practice', 'confident'],
  'd089-vocabulary': ['achievement', 'confidence', 'progress', 'effort', 'consistent', 'overcome'],
};
export const LEGACY_WORD_IDS = new Set(Object.values(LEGACY_WORDS).flat());

/** `journey` → `vocab-journey`; every other id stays as it is. */
export const courseWordId = (id: string) => (LEGACY_WORD_IDS.has(id) ? `vocab-${id}` : id);

/**
 * Renames legacy word ids inside stored JSON: the words a Vocabulary quest has
 * shown (`learnedItemIds`) and the word an answer picked (`optionId` — grammar,
 * reading and exam options are `a`…`d` and never match).
 */
export function renameWordIdsInJson(json: string): string {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (key === 'optionId' && typeof entry === 'string') return [key, courseWordId(entry)];
        if (key === 'learnedItemIds' && Array.isArray(entry)) {
          return [key, entry.map((id) => (typeof id === 'string' ? courseWordId(id) : id))];
        }
        return [key, walk(entry)];
      }),
    );
  };
  try {
    return JSON.stringify(walk(JSON.parse(json)));
  } catch {
    return json;
  }
}

type Migration = {
  version: number;
  name: string;
  up: (db: SqlExecutor) => Promise<void>;
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE user_profile (
          id TEXT PRIMARY KEY NOT NULL,
          display_name TEXT NOT NULL,
          challenge_start_date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE quest_completions (
          quest_id TEXT PRIMARY KEY NOT NULL,
          day INTEGER NOT NULL,
          quest_type TEXT NOT NULL,
          score REAL NOT NULL,
          correct_count INTEGER NOT NULL,
          total_count INTEGER NOT NULL,
          xp_earned INTEGER NOT NULL,
          source TEXT NOT NULL DEFAULT 'user',
          completed_at TEXT NOT NULL
        );
        CREATE INDEX idx_quest_completions_day ON quest_completions (day);

        CREATE TABLE answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quest_id TEXT NOT NULL,
          question_id TEXT NOT NULL,
          answer_json TEXT NOT NULL,
          is_correct INTEGER NOT NULL,
          answered_at TEXT NOT NULL
        );
        CREATE INDEX idx_answers_quest ON answers (quest_id);

        CREATE TABLE xp_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount INTEGER NOT NULL,
          reason TEXT NOT NULL,
          ref_id TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE achievement_unlocks (
          achievement_id TEXT PRIMARY KEY NOT NULL,
          unlocked_at TEXT NOT NULL
        );

        CREATE TABLE friends (
          id TEXT PRIMARY KEY NOT NULL,
          display_name TEXT NOT NULL,
          current_day INTEGER NOT NULL,
          streak INTEGER NOT NULL,
          total_xp INTEGER NOT NULL,
          completed_today INTEGER NOT NULL,
          last_active_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    name: 'quest sessions',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE quest_sessions (
          quest_id TEXT PRIMARY KEY NOT NULL,
          started_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0
        );
      `);
    },
  },
  {
    version: 3,
    name: 'quest session state, quest XP once',
    up: async (db) => {
      // A quest can hold XP only once: the database refuses a second quest
      // XP event for the same quest, whatever the app code does.
      await db.execAsync(`
        ALTER TABLE quest_sessions ADD COLUMN state_json TEXT;

        DELETE FROM xp_events
        WHERE reason = 'quest'
          AND id NOT IN (SELECT MIN(id) FROM xp_events WHERE reason = 'quest' GROUP BY ref_id);
        CREATE UNIQUE INDEX idx_xp_events_quest_once ON xp_events (ref_id) WHERE reason = 'quest';
      `);
    },
  },
  {
    version: 4,
    name: 'day completions',
    up: async (db) => {
      // One row per finished day: the primary key makes completing a day twice
      // impossible, and celebrated_at makes the celebration play only once.
      await db.execAsync(`
        CREATE TABLE day_completions (
          day INTEGER PRIMARY KEY NOT NULL,
          completed_at TEXT NOT NULL,
          quest_count INTEGER NOT NULL,
          xp_earned INTEGER NOT NULL,
          streak_before INTEGER NOT NULL,
          streak_after INTEGER NOT NULL,
          is_perfect INTEGER NOT NULL,
          celebrated_at TEXT
        );
      `);
    },
  },
  {
    version: 5,
    name: 'learned words, achievement celebrations',
    up: async (db) => {
      // Unique words need their ids: one row per word and quest, counted distinct.
      // Unlocks remember whether their celebration was shown (existing ones were).
      await db.execAsync(`
        CREATE TABLE learned_words (
          word_id TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          learned_at TEXT NOT NULL,
          PRIMARY KEY (word_id, quest_id)
        );
        ALTER TABLE achievement_unlocks ADD COLUMN celebrated_at TEXT;
        UPDATE achievement_unlocks SET celebrated_at = unlocked_at;
      `);
      // Words of vocabulary quests finished before this version.
      const done = await db.getAllAsync<{ quest_id: string; completed_at: string }>(
        "SELECT quest_id, completed_at FROM quest_completions WHERE quest_type = 'vocabulary'",
      );
      for (const row of done) {
        for (const wordId of LEGACY_WORDS[row.quest_id] ?? []) {
          await db.runAsync(
            'INSERT OR IGNORE INTO learned_words (word_id, quest_id, learned_at) VALUES (?, ?, ?)',
            [wordId, row.quest_id, row.completed_at],
          );
        }
      }
    },
  },
  {
    version: 6,
    name: 'team challenge',
    up: async (db) => {
      // The old flat `friends` list was a mock without day history; a team needs
      // each member's finished days to know the team streak. A fresh start has
      // no team — invites create it.
      await db.execAsync(`
        DROP TABLE IF EXISTS friends;
        CREATE TABLE team (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          invite_code TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE team_members (
          id TEXT PRIMARY KEY NOT NULL,
          display_name TEXT NOT NULL,
          avatar_url TEXT,
          joined_day INTEGER NOT NULL,
          today_day INTEGER,
          today_quests_done INTEGER,
          total_xp INTEGER,
          achievements_unlocked INTEGER,
          last_activity_at TEXT,
          position INTEGER NOT NULL
        );
        CREATE TABLE team_member_days (
          member_id TEXT NOT NULL,
          day INTEGER NOT NULL,
          PRIMARY KEY (member_id, day)
        );
        CREATE TABLE team_activity (
          id TEXT PRIMARY KEY NOT NULL,
          member_id TEXT NOT NULL,
          type TEXT NOT NULL,
          metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_team_activity_created ON team_activity (created_at);
      `);
    },
  },
  {
    version: 7,
    name: 'weekly exams',
    up: async (db) => {
      // One open attempt per exam at a time, and the pass reward at most once
      // per exam — whatever the app code does.
      await db.execAsync(`
        CREATE TABLE exam_attempts (
          id TEXT PRIMARY KEY NOT NULL,
          exam_id TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          number INTEGER NOT NULL,
          started_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          current_index INTEGER NOT NULL,
          answers_json TEXT NOT NULL,
          submitted_at TEXT,
          correct_count INTEGER,
          total_count INTEGER NOT NULL,
          score REAL,
          passed INTEGER
        );
        CREATE UNIQUE INDEX idx_exam_attempts_open ON exam_attempts (exam_id)
          WHERE submitted_at IS NULL;
        CREATE UNIQUE INDEX idx_xp_events_exam_pass_once ON xp_events (ref_id)
          WHERE reason = 'examPass';
      `);
    },
  },
  {
    version: 8,
    name: 'challenge completion',
    up: async (db) => {
      // One row, ever: the table cannot hold a second summit.
      await db.execAsync(`
        CREATE TABLE challenge_completion (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          completed_at TEXT NOT NULL,
          final_attempt_id TEXT NOT NULL,
          correct_count INTEGER NOT NULL,
          total_count INTEGER NOT NULL,
          score REAL NOT NULL,
          is_perfect INTEGER NOT NULL,
          xp_earned INTEGER NOT NULL,
          celebrated_at TEXT
        );
      `);
    },
  },
  {
    version: 9,
    name: 'onboarding',
    up: async (db) => {
      // A profile from before onboarding existed is a user already on the way:
      // they never see onboarding. Only a brand-new profile starts without it.
      await db.execAsync(`
        ALTER TABLE user_profile ADD COLUMN goal TEXT;
        ALTER TABLE user_profile ADD COLUMN onboarded_at TEXT;
        UPDATE user_profile SET onboarded_at = created_at;
      `);
    },
  },
  {
    version: 10,
    name: 'course version, course-wide word ids',
    up: async (db) => {
      // Progress records the course version it was earned on; everything so
      // far was earned on the first one.
      await db.execAsync(`
        ALTER TABLE quest_completions ADD COLUMN course_version INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE exam_attempts ADD COLUMN course_version INTEGER NOT NULL DEFAULT 1;
      `);
      // Words got course-wide ids ("journey" → "vocab-journey"). Progress refers
      // to words by id, so it follows: learned words, saved quest positions and
      // stored answers.
      const learned = await db.getAllAsync<{ word_id: string; quest_id: string }>(
        'SELECT word_id, quest_id FROM learned_words',
      );
      for (const row of learned) {
        const next = courseWordId(row.word_id);
        if (next === row.word_id) continue;
        // Copy under the new id (kept if it is already there), then drop the
        // old row — a word is never counted twice under two names.
        await db.runAsync(
          `INSERT OR IGNORE INTO learned_words (word_id, quest_id, learned_at)
             SELECT ?, quest_id, learned_at FROM learned_words WHERE word_id = ? AND quest_id = ?`,
          [next, row.word_id, row.quest_id],
        );
        await db.runAsync('DELETE FROM learned_words WHERE word_id = ? AND quest_id = ?', [
          row.word_id,
          row.quest_id,
        ]);
      }
      const sessions = await db.getAllAsync<{ quest_id: string; state_json: string }>(
        'SELECT quest_id, state_json FROM quest_sessions WHERE state_json IS NOT NULL',
      );
      for (const row of sessions) {
        const next = renameWordIdsInJson(row.state_json);
        if (next === row.state_json) continue;
        await db.runAsync('UPDATE quest_sessions SET state_json = ? WHERE quest_id = ?', [
          next,
          row.quest_id,
        ]);
      }
      const answers = await db.getAllAsync<{ id: number; answer_json: string }>(
        'SELECT id, answer_json FROM answers',
      );
      for (const row of answers) {
        const next = renameWordIdsInJson(row.answer_json);
        if (next === row.answer_json) continue;
        await db.runAsync('UPDATE answers SET answer_json = ? WHERE id = ?', [next, row.id]);
      }
    },
  },
  {
    version: 11,
    name: 'course cache',
    up: async (db) => {
      // The course downloaded from the API: one row, replaced only by a newer
      // course that passed validation — the last known good one.
      await db.execAsync(`
        CREATE TABLE course_cache (
          slot INTEGER PRIMARY KEY NOT NULL CHECK (slot = 1),
          course_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          schema_version INTEGER NOT NULL,
          content_hash TEXT NOT NULL,
          document TEXT NOT NULL,
          saved_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 12,
    name: 'account-scoped progress, sync outbox',
    up: async (db) => {
      // Progress belongs to an owner: `local` — the device's own, in local mode
      // and everything from before accounts — or an account's id. Every table
      // of progress is rebuilt with the owner in its key, so two accounts on one
      // phone can never see or overwrite each other's rows. Nothing is dropped:
      // what exists becomes `local`'s. `pending_mutation_id` marks a row the
      // server has not confirmed yet (see the outbox below).
      await db.execAsync(`
        CREATE TABLE user_profile_v12 (
          owner_id TEXT PRIMARY KEY NOT NULL,
          display_name TEXT NOT NULL,
          challenge_start_date TEXT NOT NULL,
          created_at TEXT NOT NULL,
          goal TEXT,
          onboarded_at TEXT,
          pending_mutation_id TEXT
        );
        INSERT INTO user_profile_v12
            (owner_id, display_name, challenge_start_date, created_at, goal, onboarded_at)
          SELECT 'local', display_name, challenge_start_date, created_at, goal, onboarded_at
          FROM user_profile WHERE id = 'local-user';
        DROP TABLE user_profile;
        ALTER TABLE user_profile_v12 RENAME TO user_profile;

        CREATE TABLE quest_completions_v12 (
          owner_id TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          course_version INTEGER NOT NULL,
          day INTEGER NOT NULL,
          quest_type TEXT NOT NULL,
          score REAL NOT NULL,
          correct_count INTEGER NOT NULL,
          total_count INTEGER NOT NULL,
          xp_earned INTEGER NOT NULL,
          source TEXT NOT NULL,
          completed_at TEXT NOT NULL,
          pending_mutation_id TEXT,
          PRIMARY KEY (owner_id, quest_id)
        );
        INSERT INTO quest_completions_v12
            (owner_id, quest_id, course_version, day, quest_type, score, correct_count,
             total_count, xp_earned, source, completed_at)
          SELECT 'local', quest_id, course_version, day, quest_type, score, correct_count,
                 total_count, xp_earned, source, completed_at
          FROM quest_completions;
        DROP TABLE quest_completions;
        ALTER TABLE quest_completions_v12 RENAME TO quest_completions;
        CREATE INDEX idx_quest_completions_owner_day ON quest_completions (owner_id, day);

        CREATE TABLE answers_v12 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          question_id TEXT NOT NULL,
          answer_json TEXT NOT NULL,
          is_correct INTEGER NOT NULL,
          answered_at TEXT NOT NULL
        );
        INSERT INTO answers_v12
            (id, owner_id, quest_id, question_id, answer_json, is_correct, answered_at)
          SELECT id, 'local', quest_id, question_id, answer_json, is_correct, answered_at
          FROM answers;
        DROP TABLE answers;
        ALTER TABLE answers_v12 RENAME TO answers;
        CREATE INDEX idx_answers_owner_quest ON answers (owner_id, quest_id);

        CREATE TABLE xp_events_v12 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          reason TEXT NOT NULL,
          ref_id TEXT,
          created_at TEXT NOT NULL,
          pending_mutation_id TEXT
        );
        INSERT INTO xp_events_v12 (id, owner_id, amount, reason, ref_id, created_at)
          SELECT id, 'local', amount, reason, ref_id, created_at FROM xp_events;
        DROP TABLE xp_events;
        ALTER TABLE xp_events_v12 RENAME TO xp_events;
        -- A badge's reward, like a quest's and an exam's, is paid once.
        DELETE FROM xp_events
        WHERE reason = 'achievement'
          AND id NOT IN (
            SELECT MIN(id) FROM xp_events WHERE reason = 'achievement' GROUP BY owner_id, ref_id
          );
        CREATE UNIQUE INDEX idx_xp_events_reward_once ON xp_events (owner_id, reason, ref_id)
          WHERE reason IN ('quest', 'examPass', 'achievement');

        CREATE TABLE achievement_unlocks_v12 (
          owner_id TEXT NOT NULL,
          achievement_id TEXT NOT NULL,
          unlocked_at TEXT NOT NULL,
          celebrated_at TEXT,
          pending_mutation_id TEXT,
          PRIMARY KEY (owner_id, achievement_id)
        );
        INSERT INTO achievement_unlocks_v12 (owner_id, achievement_id, unlocked_at, celebrated_at)
          SELECT 'local', achievement_id, unlocked_at, celebrated_at FROM achievement_unlocks;
        DROP TABLE achievement_unlocks;
        ALTER TABLE achievement_unlocks_v12 RENAME TO achievement_unlocks;

        CREATE TABLE quest_sessions_v12 (
          owner_id TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          started_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0,
          state_json TEXT,
          PRIMARY KEY (owner_id, quest_id)
        );
        INSERT INTO quest_sessions_v12
            (owner_id, quest_id, started_at, updated_at, progress, state_json)
          SELECT 'local', quest_id, started_at, updated_at, progress, state_json
          FROM quest_sessions;
        DROP TABLE quest_sessions;
        ALTER TABLE quest_sessions_v12 RENAME TO quest_sessions;

        CREATE TABLE day_completions_v12 (
          owner_id TEXT NOT NULL,
          day INTEGER NOT NULL,
          completed_at TEXT NOT NULL,
          quest_count INTEGER NOT NULL,
          xp_earned INTEGER NOT NULL,
          streak_before INTEGER NOT NULL,
          streak_after INTEGER NOT NULL,
          is_perfect INTEGER NOT NULL,
          celebrated_at TEXT,
          pending_mutation_id TEXT,
          PRIMARY KEY (owner_id, day)
        );
        INSERT INTO day_completions_v12
            (owner_id, day, completed_at, quest_count, xp_earned, streak_before, streak_after,
             is_perfect, celebrated_at)
          SELECT 'local', day, completed_at, quest_count, xp_earned, streak_before, streak_after,
                 is_perfect, celebrated_at
          FROM day_completions;
        DROP TABLE day_completions;
        ALTER TABLE day_completions_v12 RENAME TO day_completions;

        CREATE TABLE learned_words_v12 (
          owner_id TEXT NOT NULL,
          word_id TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          learned_at TEXT NOT NULL,
          pending_mutation_id TEXT,
          PRIMARY KEY (owner_id, word_id, quest_id)
        );
        INSERT INTO learned_words_v12 (owner_id, word_id, quest_id, learned_at)
          SELECT 'local', word_id, quest_id, learned_at FROM learned_words;
        DROP TABLE learned_words;
        ALTER TABLE learned_words_v12 RENAME TO learned_words;

        CREATE TABLE exam_attempts_v12 (
          owner_id TEXT NOT NULL,
          id TEXT NOT NULL,
          exam_id TEXT NOT NULL,
          quest_id TEXT NOT NULL,
          course_version INTEGER NOT NULL,
          number INTEGER NOT NULL,
          started_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          current_index INTEGER NOT NULL,
          answers_json TEXT NOT NULL,
          submitted_at TEXT,
          correct_count INTEGER,
          total_count INTEGER NOT NULL,
          score REAL,
          passed INTEGER,
          pending_mutation_id TEXT,
          PRIMARY KEY (owner_id, id)
        );
        INSERT INTO exam_attempts_v12
            (owner_id, id, exam_id, quest_id, course_version, number, started_at, updated_at,
             current_index, answers_json, submitted_at, correct_count, total_count, score, passed)
          SELECT 'local', id, exam_id, quest_id, course_version, number, started_at, updated_at,
                 current_index, answers_json, submitted_at, correct_count, total_count, score,
                 passed
          FROM exam_attempts;
        DROP TABLE exam_attempts;
        ALTER TABLE exam_attempts_v12 RENAME TO exam_attempts;
        CREATE UNIQUE INDEX idx_exam_attempts_open ON exam_attempts (owner_id, exam_id)
          WHERE submitted_at IS NULL;

        CREATE TABLE challenge_completion_v12 (
          owner_id TEXT PRIMARY KEY NOT NULL,
          completed_at TEXT NOT NULL,
          final_attempt_id TEXT NOT NULL,
          correct_count INTEGER NOT NULL,
          total_count INTEGER NOT NULL,
          score REAL NOT NULL,
          is_perfect INTEGER NOT NULL,
          xp_earned INTEGER NOT NULL,
          celebrated_at TEXT,
          pending_mutation_id TEXT
        );
        INSERT INTO challenge_completion_v12
            (owner_id, completed_at, final_attempt_id, correct_count, total_count, score,
             is_perfect, xp_earned, celebrated_at)
          SELECT 'local', completed_at, final_attempt_id, correct_count, total_count, score,
                 is_perfect, xp_earned, celebrated_at
          FROM challenge_completion;
        DROP TABLE challenge_completion;
        ALTER TABLE challenge_completion_v12 RENAME TO challenge_completion;

        CREATE TABLE team_v12 (
          owner_id TEXT NOT NULL,
          id TEXT NOT NULL,
          name TEXT NOT NULL,
          invite_code TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        INSERT INTO team_v12 (owner_id, id, name, invite_code, created_at)
          SELECT 'local', id, name, invite_code, created_at FROM team;
        DROP TABLE team;
        ALTER TABLE team_v12 RENAME TO team;

        CREATE TABLE team_members_v12 (
          owner_id TEXT NOT NULL,
          id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          avatar_url TEXT,
          joined_day INTEGER NOT NULL,
          today_day INTEGER,
          today_quests_done INTEGER,
          total_xp INTEGER,
          achievements_unlocked INTEGER,
          last_activity_at TEXT,
          position INTEGER NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        INSERT INTO team_members_v12
            (owner_id, id, display_name, avatar_url, joined_day, today_day, today_quests_done,
             total_xp, achievements_unlocked, last_activity_at, position)
          SELECT 'local', id, display_name, avatar_url, joined_day, today_day, today_quests_done,
                 total_xp, achievements_unlocked, last_activity_at, position
          FROM team_members;
        DROP TABLE team_members;
        ALTER TABLE team_members_v12 RENAME TO team_members;

        CREATE TABLE team_member_days_v12 (
          owner_id TEXT NOT NULL,
          member_id TEXT NOT NULL,
          day INTEGER NOT NULL,
          PRIMARY KEY (owner_id, member_id, day)
        );
        INSERT INTO team_member_days_v12 (owner_id, member_id, day)
          SELECT 'local', member_id, day FROM team_member_days;
        DROP TABLE team_member_days;
        ALTER TABLE team_member_days_v12 RENAME TO team_member_days;

        CREATE TABLE team_activity_v12 (
          owner_id TEXT NOT NULL,
          id TEXT NOT NULL,
          member_id TEXT NOT NULL,
          type TEXT NOT NULL,
          metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        INSERT INTO team_activity_v12 (owner_id, id, member_id, type, metadata_json, created_at)
          SELECT 'local', id, member_id, type, metadata_json, created_at FROM team_activity;
        DROP TABLE team_activity;
        ALTER TABLE team_activity_v12 RENAME TO team_activity;
        CREATE INDEX idx_team_activity_owner_created ON team_activity (owner_id, created_at);
      `);
      // What an account did offline, waiting for the server — written in the
      // same transaction as the progress it made, oldest first. Acknowledged
      // mutations leave; refused ones stay, marked, for inspection.
      await db.execAsync(`
        CREATE TABLE outbox (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          mutation_id TEXT NOT NULL UNIQUE,
          owner_id TEXT NOT NULL,
          type TEXT NOT NULL,
          mutation_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rejected')),
          attempt_count INTEGER NOT NULL DEFAULT 0,
          last_attempt_at TEXT,
          error_code TEXT,
          error_message TEXT
        );
        CREATE INDEX idx_outbox_owner ON outbox (owner_id, status, seq);

        CREATE TABLE sync_state (
          owner_id TEXT PRIMARY KEY NOT NULL,
          revision INTEGER NOT NULL,
          synced_at TEXT NOT NULL
        );

        CREATE TABLE legacy_claim (
          slot INTEGER PRIMARY KEY NOT NULL CHECK (slot = 1),
          status TEXT NOT NULL CHECK (status IN ('claimed', 'skipped', 'none')),
          owner_id TEXT,
          mutation_id TEXT,
          decided_at TEXT NOT NULL
        );
      `);
    },
  },
];

export async function runMigrations(db: SqlDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn);
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    logger.debug(`migrated database to v${migration.version} (${migration.name})`);
    currentVersion = migration.version;
  }
}
