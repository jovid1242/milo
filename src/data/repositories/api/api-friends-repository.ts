import type { CachedTeam, FriendsRepository } from '@/data/repositories/types';
import type { InviteCode, InvitePreview, MyTeamResponse, TeamInvite } from '@/schemas';
import { ApiError } from '@/services/api/api-error';

import type { TeamCache } from '../local/sqlite-team-cache';
import type { TeamApi } from './team-api';

/**
 * The team on the Milo API, for one account. Every answer about the team
 * replaces this account's cached one — and only this account's: an answer
 * that does not have the account in it (a session that changed underneath)
 * is refused, never kept. Changes need the server; offline they fail with a
 * connection error and nothing waits to be sent.
 */
export class ApiFriendsRepository implements FriendsRepository {
  readonly serverBacked = true;

  constructor(
    private readonly api: TeamApi,
    private readonly cache: TeamCache,
    /** The account's id: the owner of the cache, and a member of any team it gets. */
    readonly selfId: string,
  ) {}

  cached(): Promise<CachedTeam | null> {
    return this.cache.read();
  }

  async refresh(): Promise<CachedTeam> {
    return this.remember(await this.api.myTeam());
  }

  async create(): Promise<CachedTeam> {
    return this.remember(await this.api.create());
  }

  async invite(teamId: string): Promise<TeamInvite> {
    const invite = await this.api.invite(teamId);
    await this.updateCached((team) => (team.id === teamId ? { ...team, invite } : team));
    return invite;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this.api.revokeInvite(inviteId);
    await this.updateCached((team) =>
      team.invite?.id === inviteId ? { ...team, invite: null } : team,
    );
  }

  preview(code: InviteCode): Promise<InvitePreview> {
    return this.api.preview(code);
  }

  async join(code: InviteCode): Promise<CachedTeam> {
    return this.remember(await this.api.join(code));
  }

  async leave(teamId: string): Promise<CachedTeam> {
    await this.api.leave(teamId);
    const left: CachedTeam = { team: null, asOf: new Date().toISOString() };
    await this.cache.write(left);
    return left;
  }

  private async remember(response: MyTeamResponse): Promise<CachedTeam> {
    const { team, asOf } = response;
    if (team && !team.members.some((member) => member.userId === this.selfId)) {
      throw new ApiError('ACCOUNT_MISMATCH', 'This team answer is for another account.');
    }
    const cached: CachedTeam = { team, asOf };
    await this.cache.write(cached);
    return cached;
  }

  private async updateCached(
    change: (team: NonNullable<CachedTeam['team']>) => NonNullable<CachedTeam['team']>,
  ): Promise<void> {
    const cached = await this.cache.read();
    if (cached?.team) await this.cache.write({ ...cached, team: change(cached.team) });
  }
}
