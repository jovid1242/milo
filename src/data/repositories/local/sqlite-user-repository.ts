import { getDatabase, writeDatabase } from '@/data/db/database';
import type { ChallengeStart, UserRepository } from '@/data/repositories/types';
import { toLocalDate } from '@/lib/dates';
import { DisplayNameSchema, GoalSchema, UserSchema, type LocalDate, type User } from '@/schemas';

const LOCAL_USER_ID = 'local-user';
const DEFAULT_DISPLAY_NAME = 'Explorer';

type UserRow = {
  id: string;
  display_name: string;
  challenge_start_date: string;
  created_at: string;
  goal: string | null;
  onboarded_at: string | null;
};

const mapUser = (row: UserRow): User =>
  UserSchema.parse({
    id: row.id,
    displayName: row.display_name,
    challengeStartDate: row.challenge_start_date,
    createdAt: row.created_at,
    goal: row.goal,
    onboardedAt: row.onboarded_at,
  });

export class SqliteUserRepository implements UserRepository {
  async getUser(): Promise<User> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<UserRow>('SELECT * FROM user_profile WHERE id = ?', [
      LOCAL_USER_ID,
    ]);
    if (existing) return mapUser(existing);

    const now = new Date();
    await writeDatabase((writer) =>
      writer.runAsync(
        `INSERT OR IGNORE INTO user_profile (id, display_name, challenge_start_date, created_at)
         VALUES (?, ?, ?, ?)`,
        [LOCAL_USER_ID, DEFAULT_DISPLAY_NAME, toLocalDate(now), now.toISOString()],
      ),
    );
    const created = await db.getFirstAsync<UserRow>('SELECT * FROM user_profile WHERE id = ?', [
      LOCAL_USER_ID,
    ]);
    if (!created) throw new Error('Failed to create the local user profile');
    return mapUser(created);
  }

  async updateDisplayName(displayName: string): Promise<User> {
    const name = DisplayNameSchema.parse(displayName);
    await this.getUser();
    await writeDatabase((db) =>
      db.runAsync('UPDATE user_profile SET display_name = ? WHERE id = ?', [name, LOCAL_USER_ID]),
    );
    return this.getUser();
  }

  async completeOnboarding(start: ChallengeStart): Promise<User> {
    const name = DisplayNameSchema.parse(start.displayName);
    const goal = GoalSchema.parse(start.goal);
    await this.getUser();
    // Only the update that finds the profile still new changes it: once.
    await writeDatabase((db) =>
      db.runAsync(
        `UPDATE user_profile
           SET display_name = ?, goal = ?, challenge_start_date = ?, onboarded_at = ?
         WHERE id = ? AND onboarded_at IS NULL`,
        [name, goal, start.challengeStartDate, start.onboardedAt, LOCAL_USER_ID],
      ),
    );
    return this.getUser();
  }

  async updateChallengeStartDate(date: LocalDate): Promise<User> {
    await this.getUser();
    await writeDatabase((db) =>
      db.runAsync('UPDATE user_profile SET challenge_start_date = ? WHERE id = ?', [
        date,
        LOCAL_USER_ID,
      ]),
    );
    return this.getUser();
  }
}
