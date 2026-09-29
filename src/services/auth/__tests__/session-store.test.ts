import * as SecureStore from 'expo-secure-store';

import { sessionN } from '../../api/__fixtures__/fake-api';
import { SecureSessionStore } from '../session-store';
import { parseStoredSession } from '../stored-session';

jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      items.delete(key);
    }),
  };
});

const secure = jest.mocked(SecureStore);

describe('SecureSessionStore', () => {
  beforeEach(async () => {
    await new SecureSessionStore().clear();
    jest.clearAllMocks();
  });

  it('keeps the session in the Keychain, never beyond this device', async () => {
    const store = new SecureSessionStore();
    const { user, ...tokens } = sessionN(1);
    await store.save({ ...tokens, user });
    expect(secure.setItemAsync).toHaveBeenCalledWith('milo.auth.session', expect.any(String), {
      keychainAccessible: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    });
  });

  it('restores it on the next launch', async () => {
    const saved = sessionN(1);
    await new SecureSessionStore().save(saved);
    // A new instance: a cold launch reads what the last one wrote.
    await expect(new SecureSessionStore().load()).resolves.toEqual(saved);
  });

  it('treats an unreadable entry as signed out, and removes it', async () => {
    await secure.setItemAsync('milo.auth.session', '{"accessToken": 42');
    await expect(new SecureSessionStore().load()).resolves.toBeNull();
    expect(secure.deleteItemAsync).toHaveBeenCalledWith('milo.auth.session', expect.anything());
    await expect(new SecureSessionStore().load()).resolves.toBeNull();
  });

  it('forgets it on sign-out', async () => {
    const store = new SecureSessionStore();
    await store.save(sessionN(1));
    await store.clear();
    await expect(store.load()).resolves.toBeNull();
  });
});

describe('parseStoredSession', () => {
  it('accepts only a whole session', () => {
    expect(parseStoredSession(JSON.stringify(sessionN(1)))).toEqual(sessionN(1));
    const { refreshToken: _, ...partial } = sessionN(1);
    expect(parseStoredSession(JSON.stringify(partial))).toBeNull();
    expect(parseStoredSession('not json')).toBeNull();
  });
});
