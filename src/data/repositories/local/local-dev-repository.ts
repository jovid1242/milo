import type { LocalStore } from '@/data/db/local-store';
import type { DevRepository } from '@/data/repositories/types';
import type {
  ChallengeCompletion,
  DayCompletion,
  LearnedWord,
  QuestCompletion,
  TeamSnapshot,
  XpEvent,
} from '@/schemas';

import {
  writeChallengeCompletion,
  writeCompletion,
  writeDayCompletion,
  writeLearnedWords,
  writeXpEvent,
} from './sqlite-progress-repository';
import { writeTeamCache } from './sqlite-team-cache';

/**
 * Local-only escape hatches used by the in-app development tools — on the
 * device's own progress only: an account's progress is the server's, and
 * nothing here writes it.
 */
export class LocalDevRepository implements DevRepository {
  constructor(
    private readonly store: LocalStore,
    private readonly owner: string,
  ) {}

  async seedHistory(
    completions: readonly QuestCompletion[],
    xpEvents: readonly XpEvent[],
    days: readonly DayCompletion[],
    words: readonly LearnedWord[],
    challenge: ChallengeCompletion | null = null,
  ): Promise<void> {
    const { owner } = this;
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        for (const completion of completions) await writeCompletion(txn, owner, completion, null);
        for (const event of xpEvents) await writeXpEvent(txn, owner, event, null);
        for (const day of days) await writeDayCompletion(txn, owner, day, null);
        await writeLearnedWords(txn, owner, words, null);
        if (challenge) await writeChallengeCompletion(txn, owner, challenge, null);
      }),
    );
  }

  async replaceTeam(team: TeamSnapshot | null): Promise<void> {
    await this.store.write((db) =>
      writeTeamCache(db, this.owner, { team, asOf: new Date().toISOString() }),
    );
  }

  async resetOnboarding(): Promise<void> {
    await this.store.write((db) =>
      db.runAsync('UPDATE user_profile SET onboarded_at = NULL, goal = NULL WHERE owner_id = ?', [
        this.owner,
      ]),
    );
  }

  /**
   * Drops all local data: the device looks freshly installed, down to the
   * profile being created again on the next read. The rows go, not the file —
   * SQLite refuses to delete a database a running app holds open — and the
   * schema stays at its version.
   */
  async resetAllLocalData(): Promise<void> {
    await this.store.write(async (db) => {
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      );
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const { name } of tables) await txn.execAsync(`DELETE FROM "${name}"`);
      });
    });
  }
}
