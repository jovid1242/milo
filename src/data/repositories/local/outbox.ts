import type { SqlExecutor } from '@/data/db/local-store';
import type { ProgressMutation } from '@/schemas';

/**
 * The outbox: what an account did that the server has not heard about yet.
 * A mutation is written in the same transaction as the progress it made —
 * never one without the other.
 */
export async function enqueueMutation(
  db: SqlExecutor,
  owner: string,
  mutation: ProgressMutation,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO outbox (mutation_id, owner_id, type, mutation_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [mutation.id, owner, mutation.type, JSON.stringify(mutation), mutation.createdAt],
  );
}

/**
 * The owner's newest mutation still waiting for the server. Progress derived
 * from unconfirmed progress (a finished day, a badge) is marked with it: it
 * stays while that mutation waits, and the server's answer decides it after.
 * `null` with an empty outbox — always, in local mode.
 */
export async function pendingTag(db: SqlExecutor, owner: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ mutation_id: string }>(
    `SELECT mutation_id FROM outbox WHERE owner_id = ? AND status = 'pending'
     ORDER BY seq DESC LIMIT 1`,
    [owner],
  );
  return row?.mutation_id ?? null;
}
