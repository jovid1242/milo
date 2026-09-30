/**
 * The slice of SQLite the repositories use — expo-sqlite in the app, Node's
 * own SQLite in tests — so the code that owns local progress runs, unchanged,
 * on both.
 */

export type SqlValue = string | number | null;

export type SqlRunResult = { changes: number; lastInsertRowId: number };

export interface SqlExecutor {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: SqlValue[]): Promise<SqlRunResult>;
  getFirstAsync<T>(source: string, params?: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params?: SqlValue[]): Promise<T[]>;
}

export interface SqlDatabase extends SqlExecutor {
  /** Nothing else writes while `task` runs; it lands whole or not at all. */
  withExclusiveTransactionAsync(task: (txn: SqlExecutor) => Promise<void>): Promise<void>;
}

/** A database, opened and migrated once, and the one queue its writes take turns in. */
export interface LocalStore {
  read(): Promise<SqlDatabase>;
  /**
   * Runs `task` once every earlier write has finished. Never call it from
   * inside another write: the inner one would wait for the outer one forever.
   */
  write<T>(task: (db: SqlDatabase) => Promise<T>): Promise<T>;
}

/** `(?, ?, ?)` for `count` values. */
export const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');
