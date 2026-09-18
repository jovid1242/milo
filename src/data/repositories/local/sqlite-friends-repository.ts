import { getDatabase } from '@/data/db/database';
import type { FriendsRepository } from '@/data/repositories/types';
import { FriendSchema, type Friend } from '@/schemas';

type FriendRow = {
  id: string;
  display_name: string;
  current_day: number;
  streak: number;
  total_xp: number;
  completed_today: number;
  last_active_at: string;
};

export class SqliteFriendsRepository implements FriendsRepository {
  async getFriends(): Promise<Friend[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<FriendRow>('SELECT * FROM friends ORDER BY total_xp DESC');
    return rows.map((row) =>
      FriendSchema.parse({
        id: row.id,
        displayName: row.display_name,
        currentDay: row.current_day,
        streak: row.streak,
        totalXp: row.total_xp,
        completedToday: row.completed_today === 1,
        lastActiveAt: row.last_active_at,
      }),
    );
  }
}
