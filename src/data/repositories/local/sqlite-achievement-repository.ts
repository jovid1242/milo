import { z } from 'zod';

import { ACHIEVEMENTS } from '@/data/content/achievements';
import { getDatabase, writeDatabase } from '@/data/db/database';
import type { AchievementRepository } from '@/data/repositories/types';
import {
  AchievementSchema,
  AchievementUnlockSchema,
  type Achievement,
  type AchievementId,
  type AchievementUnlock,
  type Timestamp,
} from '@/schemas';

type UnlockRow = { achievement_id: string; unlocked_at: string };

let definitions: Achievement[] | null = null;

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

export class SqliteAchievementRepository implements AchievementRepository {
  async getDefinitions(): Promise<Achievement[]> {
    definitions ??= z.array(AchievementSchema).parse(ACHIEVEMENTS);
    return definitions;
  }

  async getUnlocks(): Promise<AchievementUnlock[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<UnlockRow>(
      'SELECT * FROM achievement_unlocks ORDER BY unlocked_at ASC',
    );
    return rows.map((row) =>
      AchievementUnlockSchema.parse({
        achievementId: row.achievement_id,
        unlockedAt: row.unlocked_at,
      }),
    );
  }

  async unlock(ids: readonly AchievementId[], unlockedAt: Timestamp): Promise<AchievementId[]> {
    if (ids.length === 0) return [];
    // Decided inside the transaction: two syncs at once cannot both unlock
    // (and pay XP for) the same achievement.
    return writeDatabase(async (db) => {
      const added: AchievementId[] = [];
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const id of ids) {
          const result = await txn.runAsync(
            'INSERT OR IGNORE INTO achievement_unlocks (achievement_id, unlocked_at) VALUES (?, ?)',
            [id, unlockedAt],
          );
          if (result.changes > 0) added.push(id);
        }
      });
      return added;
    });
  }

  async lock(ids: readonly AchievementId[]): Promise<void> {
    if (ids.length === 0) return;
    await writeDatabase((db) =>
      db.runAsync(
        `DELETE FROM achievement_unlocks WHERE achievement_id IN (${placeholders(ids.length)})`,
        [...ids],
      ),
    );
  }

  async resetUnlocks(): Promise<void> {
    await writeDatabase((db) => db.execAsync('DELETE FROM achievement_unlocks;'));
  }
}
