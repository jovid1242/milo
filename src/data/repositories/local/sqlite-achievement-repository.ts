import { z } from 'zod';

import { ACHIEVEMENTS } from '@/data/content/achievements';
import { placeholders, type LocalStore } from '@/data/db/local-store';
import type { AchievementRepository } from '@/data/repositories/types';
import {
  AchievementSchema,
  AchievementUnlockSchema,
  type Achievement,
  type AchievementId,
  type AchievementUnlock,
  type Timestamp,
} from '@/schemas';

import { pendingTag } from './outbox';

type UnlockRow = { achievement_id: string; unlocked_at: string; celebrated_at: string | null };

let definitions: Achievement[] | null = null;

/** One owner's badges. */
export class SqliteAchievementRepository implements AchievementRepository {
  constructor(
    private readonly store: LocalStore,
    private readonly owner: string,
  ) {}

  async getDefinitions(): Promise<Achievement[]> {
    definitions ??= z.array(AchievementSchema).parse(ACHIEVEMENTS);
    return definitions;
  }

  async getUnlocks(): Promise<AchievementUnlock[]> {
    const db = await this.store.read();
    const rows = await db.getAllAsync<UnlockRow>(
      'SELECT * FROM achievement_unlocks WHERE owner_id = ? ORDER BY unlocked_at ASC',
      [this.owner],
    );
    return rows.map((row) =>
      AchievementUnlockSchema.parse({
        achievementId: row.achievement_id,
        unlockedAt: row.unlocked_at,
        celebratedAt: row.celebrated_at,
      }),
    );
  }

  async unlock(ids: readonly AchievementId[], unlockedAt: Timestamp): Promise<AchievementId[]> {
    if (ids.length === 0) return [];
    // Decided inside the transaction: two syncs at once cannot both unlock
    // (and pay XP for) the same achievement.
    return this.store.write(async (db) => {
      const added: AchievementId[] = [];
      await db.withExclusiveTransactionAsync(async (txn) => {
        const tag = await pendingTag(txn, this.owner);
        for (const id of ids) {
          const result = await txn.runAsync(
            `INSERT OR IGNORE INTO achievement_unlocks
               (owner_id, achievement_id, unlocked_at, pending_mutation_id)
             VALUES (?, ?, ?, ?)`,
            [this.owner, id, unlockedAt, tag],
          );
          if (result.changes > 0) added.push(id);
        }
      });
      return added;
    });
  }

  async markCelebrated(ids: readonly AchievementId[], at: Timestamp): Promise<AchievementId[]> {
    if (ids.length === 0) return [];
    // Decided row by row inside one transaction: two claims cannot both win.
    return this.store.write(async (db) => {
      const claimed: AchievementId[] = [];
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const id of ids) {
          const result = await txn.runAsync(
            `UPDATE achievement_unlocks SET celebrated_at = ?
             WHERE owner_id = ? AND achievement_id = ? AND celebrated_at IS NULL`,
            [at, this.owner, id],
          );
          if (result.changes > 0) claimed.push(id);
        }
      });
      return claimed;
    });
  }

  async lock(ids: readonly AchievementId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.store.write((db) =>
      db.runAsync(
        `DELETE FROM achievement_unlocks WHERE owner_id = ? AND achievement_id IN (${placeholders(ids.length)})`,
        [this.owner, ...ids],
      ),
    );
  }

  async resetUnlocks(): Promise<void> {
    await this.store.write((db) =>
      db.runAsync('DELETE FROM achievement_unlocks WHERE owner_id = ?', [this.owner]),
    );
  }
}
