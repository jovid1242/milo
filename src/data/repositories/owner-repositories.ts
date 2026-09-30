import type { LocalStore } from '@/data/db/local-store';

import { AccountProgressSync } from './account-progress-sync';
import { ApiFriendsRepository } from './api/api-friends-repository';
import type { ProgressApi } from './api/progress-api';
import type { TeamApi } from './api/team-api';
import { LocalDevRepository } from './local/local-dev-repository';
import { LocalFriendsRepository } from './local/local-friends-repository';
import { SqliteAchievementRepository } from './local/sqlite-achievement-repository';
import { SqliteExamRepository } from './local/sqlite-exam-repository';
import { SqliteProgressRepository } from './local/sqlite-progress-repository';
import { LOCAL_OWNER, SqliteSyncRepository } from './local/sqlite-sync-repository';
import { SqliteTeamCache } from './local/sqlite-team-cache';
import { SqliteUserRepository } from './local/sqlite-user-repository';
import type { AuthRepository, CourseRepository, CourseUpdates, Repositories } from './types';

export { LOCAL_OWNER } from './local/sqlite-sync-repository';

/**
 * What a launch has once, whoever is signed in: the course, the session and —
 * with the Milo API — the way to it. Progress is not here: it belongs to an
 * owner (see `repositoriesFor`).
 */
export type DeviceServices = {
  auth: AuthRepository;
  course: CourseRepository;
  courseUpdates: CourseUpdates | null;
  /** Progress on the API; `null` in local mode. */
  progressApi: ProgressApi | null;
  /** Teams on the API; `null` in local mode. */
  teamApi: TeamApi | null;
  /** The account the session on this device belongs to, right now. */
  currentAccountId: () => string | null;
  store: LocalStore;
  newId: () => string;
};

/**
 * The repositories of one owner's progress: `LOCAL_OWNER` in local mode (the
 * device's own, as before accounts), an account's id otherwise. Every one of
 * them is bound to the owner for good: another account gets other instances,
 * and never sees a row of this one.
 */
export function repositoriesFor(device: DeviceServices, owner: string): Repositories {
  const { store } = device;
  const local = owner === LOCAL_OWNER;
  return {
    auth: device.auth,
    course: device.course,
    courseUpdates: device.courseUpdates,
    user: new SqliteUserRepository(store, owner),
    progress: new SqliteProgressRepository(store, owner),
    achievements: new SqliteAchievementRepository(store, owner),
    exams: new SqliteExamRepository(store, owner),
    friends:
      local || !device.teamApi
        ? new LocalFriendsRepository(new SqliteTeamCache(store, owner))
        : new ApiFriendsRepository(device.teamApi, new SqliteTeamCache(store, owner), owner),
    sync:
      local || !device.progressApi
        ? null
        : new AccountProgressSync(owner, new SqliteSyncRepository(store, owner), device.newId),
    dev: local ? new LocalDevRepository(store, owner) : null,
  };
}

/**
 * Signed out: the account and the course can be reached, progress cannot — it
 * has no owner to belong to. Reaching for it is a bug, and says so.
 */
export function repositoriesWithoutOwner(device: DeviceServices): Repositories {
  const noOwner = (name: string) =>
    new Proxy({} as never, {
      get: (_target, property) => {
        if (property === 'then') return undefined;
        throw new Error(`No one is signed in: ${name}.${String(property)} has no progress to show`);
      },
    });
  return {
    auth: device.auth,
    course: device.course,
    courseUpdates: device.courseUpdates,
    user: noOwner('user'),
    progress: noOwner('progress'),
    achievements: noOwner('achievements'),
    exams: noOwner('exams'),
    friends: noOwner('friends'),
    sync: null,
    dev: null,
  };
}
