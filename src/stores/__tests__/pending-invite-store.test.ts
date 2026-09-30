import * as SecureStore from 'expo-secure-store';

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

/** A fresh launch: the module (and its store) from scratch, the Keychain as it is. */
function launch(): typeof import('../pending-invite-store') {
  let loaded: typeof import('../pending-invite-store') | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual('../pending-invite-store');
  });
  if (!loaded) throw new Error('not loaded');
  return loaded;
}

const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

describe('a pending invite', () => {
  it('survives signing up, onboarding — and the app being closed in between', async () => {
    const first = launch().usePendingInviteStore;
    await first.getState().hydrate();
    first.getState().hold('7K2PX-9QDMA');
    await flush();
    expect(secure.setItemAsync).toHaveBeenCalledWith(
      'milo.team.pending-invite',
      expect.stringContaining('7K2PX-9QDMA'),
      { keychainAccessible: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' },
    );

    // The app is closed during onboarding and opened again.
    const next = launch().usePendingInviteStore;
    expect(next.getState().pending).toBeNull();
    await next.getState().hydrate();
    expect(next.getState().pending?.code).toBe('7K2PX-9QDMA');

    // Shown once the user can see the team: then it is gone for good.
    next.getState().clear();
    await flush();
    const after = launch().usePendingInviteStore;
    await after.getState().hydrate();
    expect(after.getState().pending).toBeNull();
  });

  it('keeps the invite opened now over an older one', async () => {
    const first = launch().usePendingInviteStore;
    first.getState().hold('AAAAA-AAAAA');
    await flush();
    const next = launch().usePendingInviteStore;
    next.getState().hold('7K2PX-9QDMA');
    await next.getState().hydrate();
    expect(next.getState().pending?.code).toBe('7K2PX-9QDMA');
  });
});
