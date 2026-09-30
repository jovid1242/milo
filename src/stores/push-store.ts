import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { create } from 'zustand';

import {
  EMPTY_PUSH_STATE,
  type PushState,
  type PushStateStore,
} from '@/features/push/team-notifications';
import { logger } from '@/lib/logger';
import { ExpoPushTokenSchema } from '@/schemas';

const KEY = 'milo.push';

/** A push token lets its holder notify this phone: kept like a secret, on this device only. */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const StoredSchema = z.object({
  enabled: z.array(z.string().min(1).max(64)).max(20),
  registration: z
    .object({ owner: z.string().min(1).max(64), token: ExpoPushTokenSchema })
    .nullable(),
  forget: z.array(ExpoPushTokenSchema).max(20),
});

/** What a previous launch kept — untrusted input: anything that does not parse is dropped. */
function parseStored(raw: string | null): PushState {
  if (raw === null) return EMPTY_PUSH_STATE;
  try {
    const parsed = StoredSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_PUSH_STATE;
  } catch {
    return EMPTY_PUSH_STATE;
  }
}

type PushStore = PushState & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  save: (next: PushState) => Promise<void>;
};

let hydrating: Promise<void> | null = null;

/** Team notifications on this device (see `features/push`), in the Keychain. */
export const usePushStore = create<PushStore>((set, get) => ({
  ...EMPTY_PUSH_STATE,
  hydrated: false,
  hydrate: () => {
    hydrating ??= (async () => {
      let stored = EMPTY_PUSH_STATE;
      try {
        stored = parseStored(await SecureStore.getItemAsync(KEY, OPTIONS));
      } catch (error) {
        logger.warn('the team notification settings could not be read', error);
      }
      set({ ...stored, hydrated: true });
    })();
    return hydrating;
  },
  save: async (next) => {
    set({ enabled: next.enabled, registration: next.registration, forget: next.forget });
    const { enabled, registration, forget } = get();
    try {
      await SecureStore.setItemAsync(
        KEY,
        JSON.stringify({ enabled, registration, forget }),
        OPTIONS,
      );
    } catch (error) {
      logger.warn('the team notification settings could not be saved', error);
    }
  },
}));

/** The store as `createTeamNotifications` uses it. */
export const pushStateStore: PushStateStore = {
  ready: () => usePushStore.getState().hydrate(),
  get: () => {
    const { enabled, registration, forget } = usePushStore.getState();
    return { enabled, registration, forget };
  },
  set: (next) => usePushStore.getState().save(next),
};
