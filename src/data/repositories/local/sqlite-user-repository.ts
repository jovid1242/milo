import { getDatabase } from '@/data/db/database';
import type { UserRepository } from '@/data/repositories/types';
import { toLocalDate } from '@/lib/dates';
import { DisplayNameSchema, UserSchema, type LocalDate, type User } from '@/schemas';

const LOCAL_USER_ID = 'local-user';
const DEFAULT_DISPLAY_NAME = 'Explorer';

type UserRow = {
  id: string;
  display_name: string;
  challenge_start_date: string;
  created_at: string;
};

const mapUser = (row: UserRow): User =>
  UserSchema.parse({
    id: row.id,
    displayName: row.display_name,
    challengeStartDate: row.challenge_start_date,
    createdAt: row.created_at,
  });

export class SqliteUserRepository implements UserRepository {
  async getUser(): Promise<User> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<UserRow>('SELECT * FROM user_profile WHERE id = ?', [
      LOCAL_USER_ID,
    ]);
    if (existing) return mapUser(existing);

    const now = new Date();
    await db.runAsync(
      `INSERT OR IGNORE INTO user_profile (id, display_name, challenge_start_date, created_at)
       VALUES (?, ?, ?, ?)`,
      [LOCAL_USER_ID, DEFAULT_DISPLAY_NAME, toLocalDate(now), now.toISOString()],
    );
    const created = await db.getFirstAsync<UserRow>('SELECT * FROM user_profile WHERE id = ?', [
      LOCAL_USER_ID,
    ]);
    if (!created) throw new Error('Failed to create the local user profile');
    return mapUser(created);
  }

  async updateDisplayName(displayName: string): Promise<User> {
    const name = DisplayNameSchema.parse(displayName);
    const db = await getDatabase();
    await this.getUser();
    await db.runAsync('UPDATE user_profile SET display_name = ? WHERE id = ?', [
      name,
      LOCAL_USER_ID,
    ]);
    return this.getUser();
  }

  async updateChallengeStartDate(date: LocalDate): Promise<User> {
    const db = await getDatabase();
    await this.getUser();
    await db.runAsync('UPDATE user_profile SET challenge_start_date = ? WHERE id = ?', [
      date,
      LOCAL_USER_ID,
    ]);
    return this.getUser();
  }
}
