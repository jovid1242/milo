import type { LocalStore } from '@/data/db/local-store';
import type { ChallengeStart, UserRepository } from '@/data/repositories/types';
import { toLocalDate } from '@/lib/dates';
import {
  DisplayNameSchema,
  GoalSchema,
  UserSchema,
  type Goal,
  type LocalDate,
  type ProgressMutation,
  type User,
} from '@/schemas';

import { enqueueMutation } from './outbox';

const DEFAULT_DISPLAY_NAME = 'Explorer';

type UserRow = {
  owner_id: string;
  display_name: string;
  challenge_start_date: string;
  created_at: string;
  goal: string | null;
  onboarded_at: string | null;
};

const mapUser = (row: UserRow): User =>
  UserSchema.parse({
    id: row.owner_id,
    displayName: row.display_name,
    challengeStartDate: row.challenge_start_date,
    createdAt: row.created_at,
    goal: row.goal,
    onboardedAt: row.onboarded_at,
  });

/** One owner's profile: the device's own in local mode, an account's otherwise. */
export class SqliteUserRepository implements UserRepository {
  constructor(
    private readonly store: LocalStore,
    private readonly owner: string,
  ) {}

  async getUser(): Promise<User> {
    const db = await this.store.read();
    const existing = await db.getFirstAsync<UserRow>(
      'SELECT * FROM user_profile WHERE owner_id = ?',
      [this.owner],
    );
    if (existing) return mapUser(existing);

    const now = new Date();
    await this.store.write((writer) =>
      writer.runAsync(
        `INSERT OR IGNORE INTO user_profile (owner_id, display_name, challenge_start_date, created_at)
         VALUES (?, ?, ?, ?)`,
        [this.owner, DEFAULT_DISPLAY_NAME, toLocalDate(now), now.toISOString()],
      ),
    );
    const created = await db.getFirstAsync<UserRow>(
      'SELECT * FROM user_profile WHERE owner_id = ?',
      [this.owner],
    );
    if (!created) throw new Error('Failed to create the local user profile');
    return mapUser(created);
  }

  async updateDisplayName(displayName: string): Promise<User> {
    const name = DisplayNameSchema.parse(displayName);
    await this.getUser();
    await this.store.write((db) =>
      db.runAsync('UPDATE user_profile SET display_name = ? WHERE owner_id = ?', [
        name,
        this.owner,
      ]),
    );
    return this.getUser();
  }

  async adoptAccountProfile(profile: { displayName: string | null; goal: Goal | null }) {
    await this.getUser();
    const name = profile.displayName === null ? null : DisplayNameSchema.parse(profile.displayName);
    const goal = profile.goal === null ? null : GoalSchema.parse(profile.goal);
    await this.store.write((db) =>
      db.runAsync(
        `UPDATE user_profile SET display_name = COALESCE(?, display_name), goal = COALESCE(?, goal)
         WHERE owner_id = ?`,
        [name, goal, this.owner],
      ),
    );
    return this.getUser();
  }

  async completeOnboarding(
    start: ChallengeStart,
    mutation: ProgressMutation | null = null,
  ): Promise<User> {
    const name = DisplayNameSchema.parse(start.displayName);
    const goal = GoalSchema.parse(start.goal);
    await this.getUser();
    // Only the update that finds the profile still new changes it: once. The
    // challenge's start goes to the outbox with it.
    await this.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        const updated = await txn.runAsync(
          `UPDATE user_profile
             SET display_name = ?, goal = ?, challenge_start_date = ?, onboarded_at = ?,
                 pending_mutation_id = ?
           WHERE owner_id = ? AND onboarded_at IS NULL`,
          [
            name,
            goal,
            start.challengeStartDate,
            start.onboardedAt,
            mutation?.id ?? null,
            this.owner,
          ],
        );
        if (updated.changes > 0 && mutation) await enqueueMutation(txn, this.owner, mutation);
      }),
    );
    return this.getUser();
  }

  async updateChallengeStartDate(date: LocalDate): Promise<User> {
    await this.getUser();
    await this.store.write((db) =>
      db.runAsync('UPDATE user_profile SET challenge_start_date = ? WHERE owner_id = ?', [
        date,
        this.owner,
      ]),
    );
    return this.getUser();
  }
}
