import { resetDatabase, writeDatabase } from '@/data/db/database';
import type { DevRepository } from '@/data/repositories/types';
import type {
  ChallengeCompletion,
  DayCompletion,
  LearnedWord,
  QuestCompletion,
  Team,
  TeamActivity,
  TeamMember,
  XpEvent,
} from '@/schemas';

import {
  clearTeam,
  writeTeam,
  writeTeamActivity,
  writeTeamMember,
} from './local-friends-repository';
import {
  writeChallengeCompletion,
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
    challenge: ChallengeCompletion | null = null,
  ): Promise<void> {
    await writeDatabase((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        for (const completion of completions) await writeCompletion(txn, completion);
        for (const event of xpEvents) await writeXpEvent(txn, event);
        for (const day of days) await writeDayCompletion(txn, day);
        await writeLearnedWords(txn, words);
        if (challenge) await writeChallengeCompletion(txn, challenge);
      }),
    );
  }

  async replaceTeam(
    team: Team | null,
    members: readonly TeamMember[],
    activity: readonly TeamActivity[],
  ): Promise<void> {
    await writeDatabase((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        await clearTeam(txn);
        if (!team) return;
        await writeTeam(txn, team);
        for (const [position, member] of members.entries()) {
          await writeTeamMember(txn, member, position);
        }
        await writeTeamActivity(txn, activity);
      }),
    );
  }

  async addTeamMember(member: TeamMember, activity: readonly TeamActivity[]): Promise<void> {
    await writeDatabase((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        const last = await txn.getFirstAsync<{ position: number | null }>(
          'SELECT MAX(position) AS position FROM team_members',
        );
        await writeTeamMember(txn, member, (last?.position ?? -1) + 1);
        await writeTeamActivity(txn, activity);
      }),
    );
  }

  async resetAllLocalData(): Promise<void> {
    await resetDatabase();
  }
}
