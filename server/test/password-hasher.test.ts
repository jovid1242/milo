import { describe, expect, it } from 'vitest';

import { PasswordHasher } from '../src/auth/password-hasher';
import { argon2Parameters } from './helpers';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes with argon2id, salted, with its parameters in the hash', async () => {
    const first = await hasher.hash('correct-horse-7');
    const second = await hasher.hash('correct-horse-7');
    expect(argon2Parameters(first)).toEqual({ m: 19456, t: 2, p: 1 });
    expect(second).not.toBe(first);
    expect(hasher.needsRehash(first)).toBe(false);
  });

  it('verifies the right password only', async () => {
    const hash = await hasher.hash('correct-horse-7');
    await expect(hasher.verify(hash, 'correct-horse-7')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'correct-horse-8')).resolves.toBe(false);
  });

  it('never matches without a hash, or with a broken one', async () => {
    await expect(hasher.verify(null, 'correct-horse-7')).resolves.toBe(false);
    await expect(hasher.verify(null, '')).resolves.toBe(false);
    await expect(hasher.verify('not-a-hash', 'correct-horse-7')).resolves.toBe(false);
  });

  it('asks for a rehash when the parameters get stronger', () => {
    const weaker =
      '$argon2id$v=19$m=4096,t=1,p=1$c29tZXNhbHRzb21lc2FsdA$YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo';
    expect(hasher.needsRehash(weaker)).toBe(true);
  });
});
