import { PushPayloadSchema, type PushPayload } from '@/schemas';
import type { PushData } from '@/services/notifications/push-adapter';

/**
 * Where a tapped team notification opens. Team news opens the Friends tab;
 * "your turn" opens Today, where the day waits to be finished.
 */
export type PushDestination = '/' | '/friends';

/** A team notification's payload — `null` for anything else (the daily reminder, a malformed one). */
export function teamPayload(data: PushData): PushPayload | null {
  const parsed = PushPayloadSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function destinationOf(payload: PushPayload): PushDestination {
  return payload.kind === 'TEAM_YOUR_TURN' ? '/' : '/friends';
}
