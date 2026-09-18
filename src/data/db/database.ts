import * as SQLite from 'expo-sqlite';

import { STORAGE } from '@/constants/challenge';

import { runMigrations } from './migrations';

let connection: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(STORAGE.databaseName);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
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

/** Drops all local data and re-runs migrations (dev tools only). */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.closeAsync();
  await SQLite.deleteDatabaseAsync(STORAGE.databaseName);
  connection = null;
  await getDatabase();
}
