import { onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

import type { SyncPlatform } from './owner-session';

/**
 * The phone's side of sync: online as React Query knows it (the network, or
 * the development switch that simulates being offline), and the moments to
 * try again — the app back in the foreground, the connection back.
 */
export const appSyncPlatform: SyncPlatform = {
  isOnline: () => onlineManager.isOnline(),
  subscribe(listener) {
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') listener('foreground');
    });
    const online = onlineManager.subscribe((isOnline) => {
      if (isOnline) listener('online');
    });
    return () => {
      app.remove();
      online();
    };
  },
};
