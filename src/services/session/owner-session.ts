import { repositoriesFor, type DeviceServices } from '@/data/repositories/owner-repositories';
import type { Account, Repositories } from '@/data/repositories/types';
import { logger } from '@/lib/logger';
import { deviceTimeZone } from '@/lib/time-zone';
import type { User } from '@/schemas';
import { ProgressSyncEngine, type SyncStatus } from '@/services/sync/progress-sync-engine';

/** What the sync needs from the platform: the connection, and when to try again. */
export type SyncPlatform = {
  isOnline(): boolean;
  /** Calls back when the app returns to the foreground or the connection comes back. */
  subscribe(listener: (reason: 'foreground' | 'online') => void): () => void;
};

/** The screens' cache of an owner's data (React Query's client in the app). */
export type OwnerCache = { clear(): void };

/**
 * Everything of one owner the app runs on: their repositories, a query cache
 * of their own and — for an account — the sync of their outbox. Another owner
 * gets another session; this one is disposed first, cache and all, so no
 * screen can ever show one account's progress to another.
 */
export type OwnerSession<Cache extends OwnerCache = OwnerCache> = {
  device: DeviceServices;
  owner: string;
  /** `null` in local mode. */
  account: Account | null;
  repositories: Repositories;
  queryClient: Cache;
  engine: ProgressSyncEngine | null;
  /** The owner's profile as the session opened: what the first frame routes by. */
  initialUser: User;
  /** Something the screens show changed: they read it again. */
  changed(): void;
  dispose(): void;
};

export type OwnerSessionOptions<Cache extends OwnerCache> = {
  device: DeviceServices;
  owner: string;
  account: Account | null;
  queryClient: Cache;
  platform: SyncPlatform;
  /** Something the screens show changed (the sync applied the server's answer). */
  onChanged: (queryClient: Cache) => void;
  onStatus?: (status: SyncStatus) => void;
};

export async function openOwnerSession<Cache extends OwnerCache>(
  options: OwnerSessionOptions<Cache>,
): Promise<OwnerSession<Cache>> {
  const { device, owner, account, queryClient } = options;
  const repositories = repositoriesFor(device, owner);
  const sync = repositories.sync;
  const api = device.progressApi;
  const engine =
    sync && api
      ? new ProgressSyncEngine({
          owner,
          repository: sync.repository,
          api,
          course: async () => {
            const course = await repositories.course.getCourse();
            return { id: course.id, version: course.version };
          },
          currentAccountId: device.currentAccountId,
          onChanged: () => options.onChanged(queryClient),
          onStatus: options.onStatus,
          isOnline: () => options.platform.isOnline(),
        })
      : null;
  const stops: (() => void)[] = [];
  if (engine && sync) {
    stops.push(sync.connect((reason) => void engine.requestSync(reason)));
    stops.push(options.platform.subscribe((reason) => void engine.requestSync(reason)));
    await engine.refresh();
  }
  if (account) await repositories.user.adoptAccountProfile(account);
  const initialUser = await repositories.user.getUser();

  let disposed = false;
  return {
    device,
    owner,
    account,
    repositories,
    queryClient,
    engine,
    initialUser,
    changed: () => options.onChanged(queryClient),
    dispose() {
      if (disposed) return;
      disposed = true;
      engine?.stop();
      for (const stop of stops) stop();
      queryClient.clear();
    },
  };
}

/** Waits for `work`, but no longer than `ms`: the work itself goes on. */
async function withTimeout(work: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([work, new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)))]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether the account has never heard from the server on this phone and has
 * nothing to show yet: then the first sync is worth a short wait before the
 * first screen — it may bring a challenge (from another phone, or the
 * phone's own progress from before accounts) instead of onboarding.
 */
export async function needsFirstSync(session: OwnerSession<OwnerCache>): Promise<boolean> {
  const sync = session.repositories.sync;
  if (!sync || !session.engine || session.initialUser.onboardedAt !== null) return false;
  return (await sync.repository.state()).syncedAt === null;
}

/**
 * An account just signed in (or was restored at launch): its progress comes
 * from the server first — briefly waited for, so a second phone never shows
 * onboarding to someone halfway through — and the device's progress from
 * before accounts is claimed or left, once (see `settleLegacyProgress`).
 * Offline, the account opens with what this device has and syncs later.
 */
export async function prepareAccount<Cache extends OwnerCache>(
  session: OwnerSession<Cache>,
  { waitMs = 8_000 } = {},
): Promise<OwnerSession<Cache>> {
  const engine = session.engine;
  if (!engine) return session;
  await withTimeout(engine.requestSync('signIn'), waitMs);
  await settleLegacyProgress(session);
  return { ...session, initialUser: await session.repositories.user.getUser() };
}

/**
 * The first account that signs in on this device after progress got accounts
 * decides what happens to the device's own progress, once: an account with no
 * progress anywhere (none on the server, none here) gets it; one that already
 * has progress never has another history merged in, and the device's own
 * stays where it is, unclaimed. Decided only on the server's word — never
 * offline — and never undone.
 */
export async function settleLegacyProgress(session: OwnerSession): Promise<void> {
  const sync = session.repositories.sync;
  const engine = session.engine;
  if (!sync || !engine || engine.current().state !== 'idle') return;
  const repository = sync.repository;
  if (await repository.legacyClaim()) return;
  const now = new Date();
  const [state, fresh] = await Promise.all([repository.state(), repository.isFresh()]);
  if (state.revision > 0 || !fresh) {
    await repository.skipLegacy(now.toISOString());
    return;
  }
  const course = await session.repositories.course.getCourse();
  const claimed = await repository.claimLegacy({
    mutationId: session.device.newId(),
    courseId: course.id,
    courseVersion: course.version,
    timeZone: deviceTimeZone(),
    now: now.toISOString(),
  });
  if (claimed) {
    logger.debug('the progress from before accounts was claimed by this account');
    session.changed();
    await withTimeout(engine.requestSync('mutation'), 8_000);
  }
}
