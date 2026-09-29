import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * argon2id, with OWASP's baseline parameters (19 MiB, 2 passes, 1 lane):
 * memory-hard, so guessing stolen hashes on GPUs stays expensive. Hashes carry
 * their parameters; stronger ones later rehash on the next successful sign-in.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHasher {
  /** A hash of a random secret, checked when the email is unknown so both paths take as long. */
  private readonly decoy = argon2.hash(randomBytes(32).toString('hex'), OPTIONS);

  hash(password: string): Promise<string> {
    return argon2.hash(password, OPTIONS);
  }

  /** `null` (no such account) does the same work and never matches. */
  async verify(hash: string | null, password: string): Promise<boolean> {
    try {
      if (hash === null) {
        await argon2.verify(await this.decoy, password);
        return false;
      }
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, OPTIONS);
  }
}
