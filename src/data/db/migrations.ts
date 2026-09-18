import type { SQLiteDatabase } from 'expo-sqlite';

import { FRIENDS_SEED } from '@/data/content/friends-seed';
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
