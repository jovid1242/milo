import { useQueryClient } from '@tanstack/react-query';
import { useNavigationContainerRef } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { queryKeys } from '@/data/query-keys';
import { useOnline } from '@/hooks/use-online';
import { logger } from '@/lib/logger';
import { usePushStore } from '@/stores/push-store';

import { watchTeamNews } from '../incoming';
import { pushAdapter, tapRouter, teamNotifications } from '../instance';

/**
 * Team notifications, from the root, with no screen of its own: keeps the
 * server's registration true to the switch and to who is signed in (`owner`,
 * `null` signed out) — at launch, on returning to the app, when the push
 * token changes and when the connection is back — and opens what a tapped
 * notification is about. The daily reminder is `ReminderSync`'s, apart.
 */
export function PushSync({ owner, inChallenge }: { owner: string | null; inChallenge: boolean }) {
  const queryClient = useQueryClient();
  const online = useOnline();
  const navigation = useNavigationContainerRef();
  const [returns, setReturns] = useState(0);

  // The switch shows what was kept, offline too.
  useEffect(() => {
    void usePushStore.getState().hydrate();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setReturns((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = pushAdapter.onTokenChange(() => {
      teamNotifications.tokenChanged();
      setReturns((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Offline there is no one to tell; the connection coming back syncs again.
    if (!online) return;
    teamNotifications
      .sync(owner)
      .catch((error: unknown) => logger.warn('team notification sync failed', error));
  }, [owner, online, returns]);

  useEffect(() => {
    const subscription = watchTeamNews(pushAdapter, () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends.team });
    });
    return () => subscription.remove();
  }, [queryClient]);

  // Taps: the listener first, then the tap that launched Milo (a cold start
  // may report it only there) — the same tap through both opens once.
  useEffect(() => {
    const subscription = pushAdapter.onTap((tap) => tapRouter.receive(tap));
    tapRouter.receiveLaunchTap();
    return () => subscription.remove();
  }, []);

  // A tap waits until the navigation is mounted; it opens as soon as it is.
  useEffect(() => {
    const update = () => tapRouter.setReadiness({ navigation: navigation.isReady(), inChallenge });
    update();
    const removeReady = navigation.addListener('ready', update);
    const removeState = navigation.addListener('state', update);
    return () => {
      removeReady();
      removeState();
      tapRouter.setReadiness({ navigation: false, inChallenge: false });
    };
  }, [navigation, inChallenge]);

  return null;
}
