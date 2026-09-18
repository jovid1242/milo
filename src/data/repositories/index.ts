import { LocalChallengeRepository } from './local/local-challenge-repository';
import { LocalDevRepository } from './local/local-dev-repository';
import { SqliteAchievementRepository } from './local/sqlite-achievement-repository';
import { SqliteFriendsRepository } from './local/sqlite-friends-repository';
import { SqliteProgressRepository } from './local/sqlite-progress-repository';
import { SqliteUserRepository } from './local/sqlite-user-repository';
import type { Repositories } from './types';

/**
 * Local-first implementations (bundled content + SQLite).
 * Swapping one of these for an API-backed implementation is the only change
 * needed when a backend appears.
 */
export function createLocalRepositories(): Repositories {
  return {
    challenge: new LocalChallengeRepository(),
    user: new SqliteUserRepository(),
    progress: new SqliteProgressRepository(),
    achievements: new SqliteAchievementRepository(),
    friends: new SqliteFriendsRepository(),
    dev: new LocalDevRepository(),
  };
}

export type * from './types';
