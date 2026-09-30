import { INVITE_CODE_ALPHABET, InviteCodeSchema, type InviteCode } from '@/schemas';

/**
 * Invite codes and links. The server makes the codes; both sides read them
 * the same way — whatever case, spaces or dashes people type them with, or
 * the whole link pasted.
 */

const CODE_LENGTH = 10;
const BITS_PER_CHAR = 5;

/** The app's own link to an invite: opens Milo on the invite's page. */
export const INVITE_LINK_PREFIX = 'milo://invite/';

/** "7k2px 9qdma", "7K2PX-9QDMA " → "7K2PX-9QDMA"; `null` when it cannot be a code. */
export function normalizeInviteCode(input: string): InviteCode | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, '');
  if (compact.length !== CODE_LENGTH) return null;
  const parsed = InviteCodeSchema.safeParse(`${compact.slice(0, 5)}-${compact.slice(5)}`);
  return parsed.success ? parsed.data : null;
}

/**
 * The code in something pasted or opened: a code, or a link to an invite —
 * `milo://invite/7K2PX-9QDMA`, or any `…/invite/<code>` address — with or
 * without a query after it. `null` when there is none.
 */
export function parseInviteInput(input: string): InviteCode | null {
  const text = input.trim();
  const linked = /\/invite\/([^/?#\s]+)/i.exec(text);
  if (linked?.[1]) {
    let segment = linked[1];
    try {
      segment = decodeURIComponent(segment);
    } catch {
      // A broken escape: the segment as it is.
    }
    return normalizeInviteCode(segment);
  }
  return normalizeInviteCode(text);
}

export function inviteLink(code: InviteCode): string {
  return `${INVITE_LINK_PREFIX}${code}`;
}

/**
 * A code from random bytes (the first 50 bits of at least seven): the server
 * derives its codes this way.
 */
export function inviteCodeFromBytes(bytes: Uint8Array): InviteCode {
  if (bytes.length * 8 < CODE_LENGTH * BITS_PER_CHAR) {
    throw new Error('An invite code needs at least 50 bits');
  }
  let code = '';
  let buffer = 0;
  let bits = 0;
  let index = 0;
  while (code.length < CODE_LENGTH) {
    if (bits < BITS_PER_CHAR) {
      buffer = ((buffer << 8) | (bytes[index] ?? 0)) & 0xffff;
      index += 1;
      bits += 8;
    }
    bits -= BITS_PER_CHAR;
    code += INVITE_CODE_ALPHABET[(buffer >> bits) & 0b11111] ?? '';
  }
  return InviteCodeSchema.parse(`${code.slice(0, 5)}-${code.slice(5)}`);
}
