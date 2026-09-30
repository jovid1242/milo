import * as Crypto from 'expo-crypto';

import { backendConfig, type BackendConfig } from '@/config/backend';
import { LOCAL_COURSE } from '@/content/course';
import { appStore } from '@/data/db/database';
import type { LocalStore } from '@/data/db/local-store';
import { AuthSessionSchema, type AuthSession } from '@/schemas';
import { ApiClient } from '@/services/api/api-client';
import { AuthSessionManager } from '@/services/auth/auth-session';
import { SecureSessionStore } from '@/services/auth/session-store';

import { ApiAuthRepository } from './api/api-auth-repository';
import { ApiCourseRepository } from './api/api-course-repository';
import { HttpCourseApi } from './api/course-api';
import { HttpProgressApi } from './api/progress-api';
import { HttpTeamApi } from './api/team-api';
import { LocalAuthRepository } from './local/local-auth-repository';
import { LocalCourseRepository } from './local/local-course-repository';
import { SqliteCourseCache } from './local/sqlite-course-cache';
import type { DeviceServices } from './owner-repositories';

export {
  LOCAL_OWNER,
  repositoriesFor,
  repositoriesWithoutOwner,
  type DeviceServices,
} from './owner-repositories';

/** The services for this build (see `config/backend.ts`). */
export function createDeviceServices(
  config: BackendConfig = backendConfig,
  store: LocalStore = appStore,
): DeviceServices {
  const newId = () => Crypto.randomUUID();
  if (!config.apiUrl) {
    return {
      auth: new LocalAuthRepository(),
      course: new LocalCourseRepository(),
      courseUpdates: null,
      progressApi: null,
      teamApi: null,
      currentAccountId: () => null,
      store,
      newId,
    };
  }

  const session: AuthSessionManager = new AuthSessionManager({
    store: new SecureSessionStore(),
    refresh: (refreshToken): Promise<AuthSession> =>
      client.request({
        method: 'POST',
        path: '/auth/refresh',
        body: { refreshToken },
        schema: AuthSessionSchema,
      }),
  });
  const client: ApiClient = new ApiClient({ baseUrl: config.apiUrl, tokens: session });
  const shared = {
    auth: new ApiAuthRepository(client, session),
    progressApi: new HttpProgressApi(client),
    teamApi: new HttpTeamApi(client),
    currentAccountId: () => session.user?.id ?? null,
    store,
    newId,
  };
  if (config.course === 'bundled') {
    return { ...shared, course: new LocalCourseRepository(), courseUpdates: null };
  }
  const course = new ApiCourseRepository({
    api: new HttpCourseApi(client),
    cache: new SqliteCourseCache(store),
    bundled: LOCAL_COURSE,
    sha256: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
  });
  return { ...shared, course, courseUpdates: course };
}

export type * from './types';
