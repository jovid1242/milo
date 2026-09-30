import { z } from 'zod';

import { INVITE_TTL_DAYS, InviteCodeSchema, TimestampSchema, type InviteCode } from '@/schemas';

/**
 * An invite opened before the app could show it — signed out, or before the
 * challenge started. It waits (on this device, in the Keychain) until the
 * user can see the team, then opens once; it is never joined without them.
 */
export const PendingInviteSchema = z.object({
  code: InviteCodeSchema,
  savedAt: TimestampSchema,
});
export type PendingInvite = z.infer<typeof PendingInviteSchema>;

/** A stored pending invite; `null` when unreadable or older than any invite lives. */
export function parsePendingInvite(
  raw: string | null,
  now: Date = new Date(),
): PendingInvite | null {
  if (raw === null) return null;
  try {
    const parsed = PendingInviteSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const age = now.getTime() - Date.parse(parsed.data.savedAt);
    return age >= 0 && age < INVITE_TTL_DAYS * 24 * 60 * 60_000 ? parsed.data : null;
  } catch {
    return null;
  }
}

export const pendingInvite = (code: InviteCode, now: Date = new Date()): PendingInvite => ({
  code,
  savedAt: now.toISOString(),
});

/**
 * What an opened invite needs first: an account, then a started challenge;
 * then its page (the team, before joining).
 */
export type InviteGate = 'signIn' | 'onboarding' | 'preview';

export function inviteGate(input: { signedIn: boolean; onboarded: boolean }): InviteGate {
  if (!input.signedIn) return 'signIn';
  return input.onboarded ? 'preview' : 'onboarding';
}
