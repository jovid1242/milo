import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { useDevStore } from '@/stores/dev-store';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Local-first: repositories read SQLite, so queries must not wait for a network.
        networkMode: 'always',
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
      },
      mutations: { networkMode: 'always', retry: 0 },
    },
  });
}

/**
 * Wires React Query to the platform: refetch when the app comes back to the
 * foreground (the current challenge day may have changed) and track connectivity
 * for the queries that will talk to a server later.
 */
export function setupQueryManagers(): () => void {
  const appStateSubscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });

  let reachable = true;
  onlineManager.setEventListener((setOnline) => {
    const publish = () => setOnline(reachable && !useDevStore.getState().simulateOffline);
    const apply = (state: Network.NetworkState) => {
      reachable = state.isInternetReachable ?? state.isConnected ?? true;
      publish();
    };

    void Network.getNetworkStateAsync().then(apply);
    const networkSubscription = Network.addNetworkStateListener(apply);
    const unsubscribeDev = useDevStore.subscribe(publish);

    return () => {
      networkSubscription.remove();
      unsubscribeDev();
    };
  });

  return () => appStateSubscription.remove();
}
