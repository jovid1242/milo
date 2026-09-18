import { getDatabase, resetDatabase } from '@/data/db/database';
import { seedFriends } from '@/data/db/migrations';
import type { DevRepository } from '@/data/repositories/types';
import type { QuestCompletion, XpEvent } from '@/schemas';

import { writeCompletion, writeXpEvent } from './sqlite-progress-repository';

/** Local-only escape hatches used by the in-app development tools. */
export class LocalDevRepository implements DevRepository {
  async seedHistory(
    completions: readonly QuestCompletion[],
    xpEvents: readonly XpEvent[],
  ): Promise<void> {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const completion of completions) await writeCompletion(txn, completion);
      for (const event of xpEvents) await writeXpEvent(txn, event);
    });
  }

  async clearFriends(): Promise<void> {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM friends;');
  }

  async restoreFriends(): Promise<void> {
    const db = await getDatabase();
    await seedFriends(db);
  }

  async resetAllLocalData(): Promise<void> {
    await resetDatabase();
  }
}
