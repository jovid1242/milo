import { LOCAL_OWNER, createDeviceServices } from '@/data/repositories';
import type { Account } from '@/data/repositories/types';
import { invalidateProgress } from '@/features/progress/queries';
import { createQueryClient } from '@/lib/query-client';
import { appSyncPlatform } from '@/services/session/app-sync-platform';
import { openOwnerSession } from '@/services/session/owner-session';
import type { AppSession } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';

/**
 * One instance per app launch, for this build's backend (local or the Milo
 * API): the session, the course, the API. Progress is opened per owner.
 */
export const deviceServices = createDeviceServices();

/** Opens the progress of an account — or, with no account (local mode), the device's own. */
export function openAppSession(account: Account | null): Promise<AppSession> {
  useSyncStore.getState().setStatus(null);
  return openOwnerSession({
    device: deviceServices,
    owner: account?.id ?? LOCAL_OWNER,
    account,
    queryClient: createQueryClient(),
    platform: appSyncPlatform,
    onChanged: invalidateProgress,
    onStatus: (status) => useSyncStore.getState().setStatus(status),
  });
}
