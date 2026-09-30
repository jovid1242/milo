import type { LocalStore, SqlDatabase, SqlExecutor, SqlRunResult, SqlValue } from '../local-store';
import { runMigrations } from '../migrations';

// Node's own SQLite (node:sqlite), typed here for the few calls used: the app's
// tsconfig has no Node types, and the server's tests run this file too.
type Statement = {
  run(...params: SqlValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
};
type NodeDatabase = {
  exec(source: string): void;
  prepare(source: string): Statement;
  close(): void;
  isOpen: boolean;
};
declare const require: (id: 'node:sqlite') => {
  DatabaseSync: new (path: string) => NodeDatabase;
};

/**
 * A `LocalStore` on Node's SQLite: the app's migrations and repositories,
 * unchanged, in tests. A file path makes "the app restarts" testable — close
 * it, open the same file again.
 */
export class NodeSqliteStore implements LocalStore {
  private readonly db: NodeDatabase;
  private readonly ready: Promise<SqlDatabase>;
  private writes: Promise<unknown> = Promise.resolve();
  private readonly database: SqlDatabase;

  constructor(path = ':memory:', options: { migrate?: boolean } = {}) {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON;');
    const executor: SqlExecutor = {
      execAsync: async (source) => {
        this.db.exec(source);
      },
      runAsync: async (source, params = []) => {
        const result = this.db.prepare(source).run(...params);
        return {
          changes: Number(result.changes),
          lastInsertRowId: Number(result.lastInsertRowid),
        } satisfies SqlRunResult;
      },
      getFirstAsync: async <T>(source: string, params: SqlValue[] = []) =>
        ((this.db.prepare(source).get(...params) as T | undefined) ?? null) as T | null,
      getAllAsync: async <T>(source: string, params: SqlValue[] = []) =>
        this.db.prepare(source).all(...params) as T[],
    };
    this.database = {
      ...executor,
      withExclusiveTransactionAsync: async (task) => {
        this.db.exec('BEGIN EXCLUSIVE');
        try {
          await task(executor);
          this.db.exec('COMMIT');
        } catch (error) {
          this.db.exec('ROLLBACK');
          throw error;
        }
      },
    };
    this.ready =
      options.migrate === false
        ? Promise.resolve(this.database)
        : runMigrations(this.database).then(() => this.database);
  }

  read(): Promise<SqlDatabase> {
    return this.ready;
  }

  write<T>(task: (db: SqlDatabase) => Promise<T>): Promise<T> {
    const run = this.writes.then(async () => task(await this.ready));
    this.writes = run.catch(() => undefined);
    return run;
  }

  /** Waits for pending writes, then closes the file — the app going away. */
  async close(): Promise<void> {
    await this.writes;
    if (this.db.isOpen) this.db.close();
  }
}
