import type { LocalStore, SqlExecutor } from '@/data/db/local-store';
import { TeamSnapshotSchema } from '@/schemas';

import type { CachedTeam } from '../types';

/** The last answer about the team, kept per owner — what the Friends tab shows offline. */
export interface TeamCache {
  read(): Promise<CachedTeam | null>;
  write(cached: CachedTeam): Promise<void>;
}

type Row = { team_json: string | null; as_of: string };

/** A team as stored; an answer this app can no longer read counts as none. */
function parse(row: Row): CachedTeam | null {
  if (row.team_json === null) return { team: null, asOf: row.as_of };
  try {
    const team = TeamSnapshotSchema.safeParse(JSON.parse(row.team_json));
    return team.success ? { team: team.data, asOf: row.as_of } : null;
  } catch {
    return null;
  }
}

/** Shared with the dev repository, which puts demo teams here in local mode. */
export async function writeTeamCache(db: SqlExecutor, owner: string, cached: CachedTeam) {
  await db.runAsync(
    `INSERT INTO team_cache (owner_id, team_json, as_of) VALUES (?, ?, ?)
     ON CONFLICT(owner_id) DO UPDATE SET team_json = excluded.team_json, as_of = excluded.as_of`,
    [owner, cached.team ? JSON.stringify(cached.team) : null, cached.asOf],
  );
}

export class SqliteTeamCache implements TeamCache {
  constructor(
    private readonly store: LocalStore,
    private readonly owner: string,
  ) {}

  async read(): Promise<CachedTeam | null> {
    const db = await this.store.read();
    const row = await db.getFirstAsync<Row>(
      'SELECT team_json, as_of FROM team_cache WHERE owner_id = ?',
      [this.owner],
    );
    return row ? parse(row) : null;
  }

  async write(cached: CachedTeam): Promise<void> {
    await this.store.write((db) => writeTeamCache(db, this.owner, cached));
  }
}

/** The same, in memory (tests). */
export class MemoryTeamCache implements TeamCache {
  private cached: CachedTeam | null = null;

  async read(): Promise<CachedTeam | null> {
    return this.cached;
  }

  async write(cached: CachedTeam): Promise<void> {
    this.cached = cached;
  }
}
