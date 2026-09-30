import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { usePendingInviteStore } from '@/stores/pending-invite-store';

/**
 * Opens an invite that had to wait — opened while signed out, or before the
 * challenge started — once the user can see the team. Only its page: the
 * user still decides whether to join.
 */
export function PendingInviteWatcher({ inChallenge }: { inChallenge: boolean }) {
  const router = useRouter();
  const pending = usePendingInviteStore((state) => state.pending);
  const hydrated = usePendingInviteStore((state) => state.hydrated);
  const opened = useRef<string | null>(null);

  useEffect(() => {
    void usePendingInviteStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated || !inChallenge || !pending || opened.current === pending.code) return;
    opened.current = pending.code;
    router.push({ pathname: '/invite/[code]', params: { code: pending.code } });
  }, [hydrated, inChallenge, pending, router]);

  return null;
}
