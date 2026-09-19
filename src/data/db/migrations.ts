import type { SQLiteDatabase } from 'expo-sqlite';

import { FRIENDS_SEED } from '@/data/content/friends-seed';
import { QUEST_CONTENT } from '@/data/content/lessons';
import { logger } from '@/lib/logger';

type Migration = {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
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
      await seedFriends(db);
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
        const content = QUEST_CONTENT.get(row.quest_id);
        if (content?.type !== 'vocabulary') continue;
        for (const item of content.items) {
          await db.runAsync(
            'INSERT OR IGNORE INTO learned_words (word_id, quest_id, learned_at) VALUES (?, ?, ?)',
            [item.id, row.quest_id, row.completed_at],
          );
        }
      }
    },
  },
];

/** Mock team data behaves like cached server data until a backend exists. */
export async function seedFriends(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();
  for (const friend of FRIENDS_SEED) {
    await db.runAsync(
      `INSERT OR REPLACE INTO friends
         (id, display_name, current_day, streak, total_xp, completed_today, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        friend.id,
        friend.displayName,
        friend.currentDay,
        friend.streak,
        friend.totalXp,
        friend.completedToday ? 1 : 0,
        new Date(now - friend.lastActiveMinutesAgo * 60_000).toISOString(),
      ],
    );
  }
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
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
