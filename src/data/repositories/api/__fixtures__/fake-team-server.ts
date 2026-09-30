import { inviteCodeFromBytes } from '@/features/friends/logic/invite-code';
import {
  INVITE_TTL_DAYS,
  TEAM_CAPACITY,
  type ApiErrorCode,
  type InviteCode,
  type InvitePreview,
  type MyTeamResponse,
  type TeamInvite,
  type TeamMemberSummary,
  type TeamSnapshot,
} from '@/schemas';
import { ApiError } from '@/services/api/api-error';

import type { TeamApi } from '../team-api';

type Member = { userId: string; role: 'owner' | 'member'; joinedAt: string };
type Invite = TeamInvite & { teamId: string; revoked: boolean };
type Team = { id: string; createdAt: string; members: Member[] };

const DAY_MS = 24 * 60 * 60 * 1000;

const refuse = (status: number, code: ApiErrorCode) => new ApiError(code, code, status);

/**
 * A stand-in for the Milo API's team endpoints in the app's tests: the same
 * rules and refusals (capacity, one team each, invites that expire or are
 * turned off), kept simply in memory. The real rules — locks, the database's
 * limits, progress summaries — are tested against the real server.
 */
export class FakeTeamServer {
  offline = false;
  now = () => new Date();
  /** Names, as accounts set them in onboarding. */
  readonly names = new Map<string, string>();
  /** What members show of each other (the server derives it from progress). */
  readonly progress = new Map<string, Partial<TeamMemberSummary>>();
  private readonly teams = new Map<string, Team>();
  private readonly invites: Invite[] = [];
  private ids = 0;

  /** The API as a device signed in as `signedIn()` reaches it. */
  api(signedIn: () => string | null): TeamApi {
    const as = async <T>(work: (user: string) => T): Promise<T> => {
      if (this.offline) throw new ApiError('NETWORK_ERROR', 'Could not reach the server.');
      const user = signedIn();
      if (!user) throw refuse(401, 'UNAUTHORIZED');
      return work(user);
    };
    return {
      myTeam: () => as((user) => this.answer(user)),
      create: () => as((user) => this.create(user)),
      invite: (teamId) => as((user) => this.invite(user, teamId)),
      revokeInvite: (inviteId) => as((user) => this.revoke(user, inviteId)),
      preview: (code) => as((user) => this.preview(user, code)),
      join: (code) => as((user) => this.join(user, code)),
      leave: (teamId) => as((user) => this.leave(user, teamId)),
    };
  }

  /** Moves an invite's end to now: it has expired. */
  expire(code: InviteCode): void {
    const invite = this.invites.find((item) => item.code === code);
    if (invite) invite.expiresAt = this.now().toISOString();
  }

  private id(): string {
    this.ids += 1;
    return `00000000-0000-4000-8000-${String(this.ids).padStart(12, '0')}`;
  }

  private teamOf(user: string): Team | null {
    return (
      [...this.teams.values()].find((team) => team.members.some((m) => m.userId === user)) ?? null
    );
  }

  private snapshot(team: Team): TeamSnapshot {
    const owner = team.members.find((member) => member.role === 'owner');
    const now = this.now();
    const invite =
      team.members.length < TEAM_CAPACITY
        ? (this.invites.findLast(
            (item) =>
              item.teamId === team.id &&
              !item.revoked &&
              Date.parse(item.expiresAt) > now.getTime(),
          ) ?? null)
        : null;
    return {
      id: team.id,
      name: `${this.names.get(owner?.userId ?? '') ?? 'Milo'}'s team`,
      capacity: TEAM_CAPACITY,
      createdAt: team.createdAt,
      members: team.members.map((member) => ({
        userId: member.userId,
        displayName: this.names.get(member.userId) ?? 'Teammate',
        avatarUrl: null,
        role: member.role,
        joinedAt: member.joinedAt,
        currentDay: 1,
        todayCompleted: false,
        todayQuestsDone: 0,
        streak: 0,
        totalXp: 0,
        daysCompleted: 0,
        achievementsUnlocked: 0,
        lastActivityAt: null,
        ...this.progress.get(member.userId),
      })),
      streak: { current: 0, longest: 0, todayComplete: false },
      invite: invite
        ? {
            id: invite.id,
            code: invite.code,
            createdBy: invite.createdBy,
            createdAt: invite.createdAt,
            expiresAt: invite.expiresAt,
          }
        : null,
    };
  }

  private answer(user: string): MyTeamResponse {
    const team = this.teamOf(user);
    return { team: team ? this.snapshot(team) : null, asOf: this.now().toISOString() };
  }

  private create(user: string): MyTeamResponse {
    if (this.teamOf(user)) throw refuse(409, 'ALREADY_IN_TEAM');
    const id = this.id();
    const at = this.now().toISOString();
    this.teams.set(id, {
      id,
      createdAt: at,
      members: [{ userId: user, role: 'owner', joinedAt: at }],
    });
    return this.answer(user);
  }

  private invite(user: string, teamId: string): TeamInvite {
    const team = this.teams.get(teamId);
    if (!team || !team.members.some((member) => member.userId === user)) {
      throw refuse(404, 'TEAM_NOT_FOUND');
    }
    if (team.members.length >= TEAM_CAPACITY) throw refuse(409, 'TEAM_FULL');
    const open = this.snapshot(team).invite;
    if (open && Date.parse(open.expiresAt) - this.now().getTime() > DAY_MS) return open;
    const id = this.id();
    const bytes = new Uint8Array(8).map((_, index) => (this.ids * 37 + index * 101) % 256);
    const created: Invite = {
      id,
      code: inviteCodeFromBytes(bytes),
      createdBy: user,
      createdAt: this.now().toISOString(),
      expiresAt: new Date(this.now().getTime() + INVITE_TTL_DAYS * DAY_MS).toISOString(),
      teamId,
      revoked: false,
    };
    this.invites.push(created);
    return this.snapshot(team).invite ?? created;
  }

  private revoke(user: string, inviteId: string): void {
    const invite = this.invites.find((item) => item.id === inviteId);
    const team = invite ? this.teams.get(invite.teamId) : undefined;
    const member = team?.members.find((item) => item.userId === user);
    if (!invite || !member) throw refuse(404, 'NOT_FOUND');
    if (invite.createdBy !== user && member.role !== 'owner') throw refuse(403, 'FORBIDDEN');
    invite.revoked = true;
  }

  private resolve(code: InviteCode): { invite: Invite; team: Team } {
    const invite = this.invites.find((item) => item.code === code);
    const team = invite ? this.teams.get(invite.teamId) : undefined;
    if (!invite || !team) throw refuse(404, 'INVITE_INVALID');
    if (invite.revoked) throw refuse(410, 'INVITE_REVOKED');
    if (Date.parse(invite.expiresAt) <= this.now().getTime()) throw refuse(410, 'INVITE_EXPIRED');
    return { invite, team };
  }

  private preview(user: string, code: InviteCode): InvitePreview {
    const { invite, team } = this.resolve(code);
    const mine = this.teamOf(user);
    const owner = team.members.find((member) => member.role === 'owner');
    return {
      teamName: this.snapshot(team).name,
      ownerName: this.names.get(owner?.userId ?? '') ?? 'Teammate',
      memberCount: team.members.length,
      capacity: TEAM_CAPACITY,
      expiresAt: invite.expiresAt,
      status:
        mine?.id === team.id
          ? 'alreadyMember'
          : mine
            ? 'inAnotherTeam'
            : team.members.length >= TEAM_CAPACITY
              ? 'full'
              : 'canJoin',
    };
  }

  private join(user: string, code: InviteCode): MyTeamResponse {
    const { team } = this.resolve(code);
    const mine = this.teamOf(user);
    if (mine?.id === team.id) throw refuse(409, 'ALREADY_MEMBER');
    if (mine) throw refuse(409, 'ALREADY_IN_TEAM');
    if (team.members.length >= TEAM_CAPACITY) throw refuse(409, 'TEAM_FULL');
    team.members.push({ userId: user, role: 'member', joinedAt: this.now().toISOString() });
    return this.answer(user);
  }

  private leave(user: string, teamId: string): void {
    const team = this.teams.get(teamId);
    const member = team?.members.find((item) => item.userId === user);
    if (!team || !member) throw refuse(404, 'TEAM_NOT_FOUND');
    team.members = team.members.filter((item) => item.userId !== user);
    for (const invite of this.invites) {
      if (invite.teamId === teamId && invite.createdBy === user) invite.revoked = true;
    }
    const [successor] = team.members;
    if (!successor) this.teams.delete(teamId);
    else if (member.role === 'owner') successor.role = 'owner';
  }
}
