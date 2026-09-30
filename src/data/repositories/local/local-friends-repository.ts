import type { CachedTeam, FriendsRepository } from '@/data/repositories/types';
import type { InviteCode, InvitePreview, TeamInvite } from '@/schemas';

import type { TeamCache } from './sqlite-team-cache';

/** The user's id in a local (demo) team: local mode has no account to take it from. */
export const LOCAL_SELF_ID = '00000000-0000-4000-8000-000000000000';

/** Teams need the Milo API; a build without it says so instead of pretending. */
export class TeamsUnavailableError extends Error {
  constructor() {
    super('Teams need the Milo online service, which this build does not use.');
    this.name = 'TeamsUnavailableError';
  }
}

/**
 * Local mode: no server, so no team anyone could join. What the cache holds
 * (a demo put there by the dev tools) is shown; every change is refused.
 */
export class LocalFriendsRepository implements FriendsRepository {
  readonly serverBacked = false;
  readonly selfId = LOCAL_SELF_ID;

  constructor(private readonly cache: TeamCache) {}

  cached(): Promise<CachedTeam | null> {
    return this.cache.read();
  }

  async refresh(): Promise<CachedTeam> {
    return (await this.cache.read()) ?? { team: null, asOf: new Date().toISOString() };
  }

  create(): Promise<CachedTeam> {
    return Promise.reject(new TeamsUnavailableError());
  }

  invite(_teamId: string): Promise<TeamInvite> {
    return Promise.reject(new TeamsUnavailableError());
  }

  revokeInvite(_inviteId: string): Promise<void> {
    return Promise.reject(new TeamsUnavailableError());
  }

  preview(_code: InviteCode): Promise<InvitePreview> {
    return Promise.reject(new TeamsUnavailableError());
  }

  join(_code: InviteCode): Promise<CachedTeam> {
    return Promise.reject(new TeamsUnavailableError());
  }

  leave(_teamId: string): Promise<CachedTeam> {
    return Promise.reject(new TeamsUnavailableError());
  }
}
