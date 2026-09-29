import * as Crypto from 'expo-crypto';

import { backendConfig, type BackendConfig } from '@/config/backend';
import { LOCAL_COURSE } from '@/content/course';
import { AuthSessionSchema, type AuthSession } from '@/schemas';
import { ApiClient } from '@/services/api/api-client';
import { AuthSessionManager } from '@/services/auth/auth-session';
import { SecureSessionStore } from '@/services/auth/session-store';

import { ApiAuthRepository } from './api/api-auth-repository';
import { ApiCourseRepository } from './api/api-course-repository';
import { HttpCourseApi } from './api/course-api';
import { LocalAuthRepository } from './local/local-auth-repository';
import { LocalCourseRepository } from './local/local-course-repository';
import { LocalDevRepository } from './local/local-dev-repository';
import { LocalFriendsRepository } from './local/local-friends-repository';
import { SqliteAchievementRepository } from './local/sqlite-achievement-repository';
import { SqliteCourseCache } from './local/sqlite-course-cache';
import { SqliteExamRepository } from './local/sqlite-exam-repository';
import { SqliteProgressRepository } from './local/sqlite-progress-repository';
import { SqliteUserRepository } from './local/sqlite-user-repository';
import type { Repositories } from './types';

/** Local-first implementations: the bundled course and SQLite, no account. */
export function createLocalRepositories(): Repositories {
  return {
    auth: new LocalAuthRepository(),
    course: new LocalCourseRepository(),
    courseUpdates: null,
    user: new SqliteUserRepository(),
    progress: new SqliteProgressRepository(),
    achievements: new SqliteAchievementRepository(),
    exams: new SqliteExamRepository(),
    friends: new LocalFriendsRepository(),
    dev: new LocalDevRepository(),
  };
}

/**
 * The repositories for this build (see `config/backend.ts`). With the Milo API
 * configured, the account and the course come from it; progress stays in
 * SQLite either way — it is not synced yet.
 */
export function createAppRepositories(config: BackendConfig = backendConfig): Repositories {
  const local = createLocalRepositories();
  if (!config.apiUrl) return local;

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
  const auth = new ApiAuthRepository(client, session);
  if (config.course === 'bundled') return { ...local, auth };

  const course = new ApiCourseRepository({
    api: new HttpCourseApi(client),
    cache: new SqliteCourseCache(),
    bundled: LOCAL_COURSE,
    sha256: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
  });
  return { ...local, auth, course, courseUpdates: course };
}

export type * from './types';
