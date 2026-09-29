import { z } from 'zod';

import { RefreshTokenSchema, TimestampSchema, UserDtoSchema } from '@/schemas';

/** A signed-in session as the device keeps it: the token pair and the account it belongs to. */
export const StoredSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: TimestampSchema,
  refreshToken: RefreshTokenSchema,
  refreshTokenExpiresAt: TimestampSchema,
  user: UserDtoSchema,
});
export type StoredSession = z.infer<typeof StoredSessionSchema>;

/** Where the session lives between launches: the Keychain in the app, memory in tests. */
export interface SessionStore {
  /** `null` when there is none — or when what is stored cannot be read (it is then removed). */
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

export function parseStoredSession(raw: string): StoredSession | null {
  try {
    const parsed = StoredSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Same contract, in memory: tests. */
export class MemorySessionStore implements SessionStore {
  saved: StoredSession | null = null;

  constructor(initial: StoredSession | null = null) {
    this.saved = initial;
  }

  async load(): Promise<StoredSession | null> {
    return this.saved;
  }

  async save(session: StoredSession): Promise<void> {
    this.saved = session;
  }

  async clear(): Promise<void> {
    this.saved = null;
  }
}
