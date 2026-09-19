import { InviteCodeSchema, type InviteCode } from '@/schemas';

/** No 0/O or 1/I: a code that can be read out loud. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A new invite code, e.g. "MILO-7K2P". `random` is injectable for tests. */
export function generateInviteCode(random: () => number = Math.random): InviteCode {
  let suffix = '';
  for (let index = 0; index < 4; index++) {
    suffix += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? 'M';
  }
  return InviteCodeSchema.parse(`MILO-${suffix}`);
}

/** "milo 7k2p", " MILO-7K2P " → "MILO-7K2P"; `null` when it cannot be a code. */
export function normalizeInviteCode(input: string): InviteCode | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const suffix = compact.startsWith('MILO') ? compact.slice(4) : compact;
  const parsed = InviteCodeSchema.safeParse(`MILO-${suffix}`);
  return parsed.success ? parsed.data : null;
}
