import * as SecureStore from 'expo-secure-store';

import { parseStoredSession, type SessionStore, type StoredSession } from './stored-session';

const KEY = 'milo.auth.session';

/**
 * The Keychain, never AsyncStorage: tokens are readable once the device has
 * been unlocked after a restart, and never leave it — not in a backup, not
 * to another phone. A new device signs in again.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export class SecureSessionStore implements SessionStore {
  async load(): Promise<StoredSession | null> {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (raw === null) return null;
    const session = parseStoredSession(raw);
    // Unreadable (an older format, a partial write): as good as signed out.
    if (!session) await this.clear();
    return session;
  }

  save(session: StoredSession): Promise<void> {
    return SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS);
  }

  clear(): Promise<void> {
    return SecureStore.deleteItemAsync(KEY, OPTIONS);
  }
}
