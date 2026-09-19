import { resetDatabase, writeDatabase } from '@/data/db/database';
import { seedFriends } from '@/data/db/migrations';
import type { DevRepository } from '@/data/repositories/types';
import type { DayCompletion, LearnedWord, QuestCompletion, XpEvent } from '@/schemas';

import {
  writeCompletion,
  writeDayCompletion,
  writeLearnedWords,
  writeXpEvent,
} from './sqlite-progress-repository';

/** Local-only escape hatches used by the in-app development tools. */
export class LocalDevRepository implements DevRepository {
  async seedHistory(
    completions: readonly QuestCompletion[],
    xpEvents: readonly XpEvent[],
    days: readonly DayCompletion[],
    words: readonly LearnedWord[],
  ): Promise<void> {
    await writeDatabase((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        for (const completion of completions) await writeCompletion(txn, completion);
        for (const event of xpEvents) await writeXpEvent(txn, event);
        for (const day of days) await writeDayCompletion(txn, day);
        await writeLearnedWords(txn, words);
      }),
    );
  }

  async clearFriends(): Promise<void> {
    await writeDatabase((db) => db.execAsync('DELETE FROM friends;'));
  }

  async restoreFriends(): Promise<void> {
    await writeDatabase((db) => seedFriends(db));
  }

  async resetAllLocalData(): Promise<void> {
    await resetDatabase();
  }
}
