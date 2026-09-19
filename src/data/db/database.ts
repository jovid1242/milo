import * as SQLite from 'expo-sqlite';

import { STORAGE } from '@/constants/challenge';

import { runMigrations } from './migrations';

let connection: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(STORAGE.databaseName);
  // busy_timeout: a safety net — a write that still meets another one waits
  // briefly instead of failing at once with "database is locked".
  await db.execAsync(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;',
  );
  await runMigrations(db);
  return db;
}

/** Opens (and migrates) the database once; every repository awaits this. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  connection ??= openDatabase().catch((error: unknown) => {
    connection = null; // let the next call retry instead of caching the failure
    throw error;
  });
  return connection;
}

let writes: Promise<unknown> = Promise.resolve();

/**
 * Runs a write once every earlier write has finished. Exclusive transactions
 * open their own connection, and SQLite turns a second writer away ("database
 * is locked") instead of queueing it — so writes never meet: a double tap on
 * "Finish" simply waits its turn, then finds the work already done.
 *
 * Never call it from inside another write: the inner write would wait for the
 * outer one forever. Repositories take it once, at their public methods.
 */
export function writeDatabase<T>(task: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const run = writes.then(async () => task(await getDatabase()));
  writes = run.catch(() => undefined);
  return run;
}

/** Drops all local data and re-runs migrations (dev tools only). */
export function resetDatabase(): Promise<void> {
  return writeDatabase(async (db) => {
    await db.closeAsync();
    await SQLite.deleteDatabaseAsync(STORAGE.databaseName);
    connection = null;
    await getDatabase();
  });
}
