import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { normalizeInviteCode } from '@/features/friends/logic/invite-code';
import {
  INVITE_TTL_DAYS,
  TEAM_CAPACITY,
  type InvitePreview,
  type InvitePreviewStatus,
  type MyTeamResponse,
  type TeamInvite,
} from '@/schemas';

import { ApiException } from '../common/api-exception';
import { CLOCK, type Clock } from '../common/clock';
import { CourseService } from '../course/course.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InviteCodes } from './invite-codes';
import { loadRoster, nameOf, teamName, teamSnapshot } from './team-progress';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
/** An open invite is handed out again while it has at least this long left. */
const REUSE_MIN_LEFT_MS = DAY_MS;

const iso = (date: Date) => date.toISOString();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const teamNotFound = () =>
  new ApiException(404, 'TEAM_NOT_FOUND', 'You are not in this team, or it does not exist.');
const inviteInvalid = () =>
  new ApiException(
    404,
    'INVITE_INVALID',
    'This invite code does not work. Check it and try again.',
  );
const inviteExpired = () =>
  new ApiException(410, 'INVITE_EXPIRED', 'This invite has expired. Ask for a new one.');
const inviteRevoked = () =>
  new ApiException(410, 'INVITE_REVOKED', 'This invite was turned off. Ask for a new one.');
const teamFull = () =>
  new ApiException(409, 'TEAM_FULL', `This team is full: a team has ${TEAM_CAPACITY} people.`);
const alreadyMember = () =>
  new ApiException(409, 'ALREADY_MEMBER', 'You are in this team already.');
const alreadyInTeam = () =>
  new ApiException(409, 'ALREADY_IN_TEAM', 'You are in a team already: leave it first.');
const challengeNotStarted = () =>
  new ApiException(409, 'CHALLENGE_NOT_STARTED', 'Teams are for a challenge that has started.');

/** Every team change of a user waits here for the one before it (and for their progress writes). */
const lockUser = (tx: Tx, userId: string) =>
  tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;

/** Every change of a team's membership waits here: joins take turns, so a fourth never fits. */
async function lockTeam(tx: Tx, teamId: string) {
  const rows = await tx.$queryRaw<
    { id: string; courseId: string; name: string | null; createdAt: Date }[]
  >`
    SELECT "id", "courseId", "name", "createdAt" FROM "teams" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
  return rows[0] ?? null;
}

/**
 * The database's own limits, should anything ever get past the locks: a
 * second team for the user, or a place in the team that is taken.
 */
function uniqueViolation(error: unknown): ApiException | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
    return null;
  return JSON.stringify(error.meta ?? {}).includes('userId') ? alreadyInTeam() : teamFull();
}

/**
 * Teams: made, joined and left here, and nowhere else. Capacity is kept by
 * locking the team's row for every change of its membership — and by the
 * database, which has three places per team and one team per user. Invite
 * codes are never logged, only the invite's id.
 */
@Injectable()
export class TeamsService {
  private readonly logger = new Logger('Teams');

  constructor(
    private readonly prisma: PrismaService,
    private readonly course: CourseService,
    private readonly codes: InviteCodes,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** `GET /teams/me`: the user's team, or `null`. */
  async myTeam(userId: string): Promise<MyTeamResponse> {
    const now = this.clock.now();
    const team = await this.prisma.$transaction(
      async (tx) => {
        const membership = await tx.teamMember.findUnique({
          where: { userId },
          select: { team: { select: { id: true, courseId: true, name: true, createdAt: true } } },
        });
        return membership ? this.snapshot(tx, membership.team, userId, now) : null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { team, asOf: iso(now) };
  }

  /** `POST /teams`: a new team with the user as its owner. */
  async create(userId: string): Promise<MyTeamResponse> {
    const now = this.clock.now();
    const courseId = this.course.content().id;
    const team = await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const challenge = await tx.userChallenge.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true },
      });
      if (!challenge) throw challengeNotStarted();
      if (await tx.teamMember.findUnique({ where: { userId } })) throw alreadyInTeam();
      const created = await tx.team.create({
        data: {
          courseId,
          createdById: userId,
          createdAt: now,
          members: { create: { userId, slot: 1, role: 'owner', joinedAt: now } },
        },
        select: { id: true, courseId: true, name: true, createdAt: true },
      });
      this.logger.log({ teamId: created.id, userId }, 'Team created');
      return this.snapshot(tx, created, userId, now);
    });
    return { team, asOf: iso(now) };
  }

  /**
   * `POST /teams/:teamId/invites`: the team's open invite — the same one for
   * every member while it has a day or more left, else a new one. There is
   * nothing to invite to in a full team.
   */
  async invite(userId: string, teamId: string): Promise<TeamInvite> {
    if (!UUID.test(teamId)) throw teamNotFound();
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const team = await lockTeam(tx, teamId);
      const membership = await tx.teamMember.findUnique({ where: { userId } });
      if (!team || membership?.teamId !== teamId) throw teamNotFound();
      if ((await tx.teamMember.count({ where: { teamId } })) >= TEAM_CAPACITY) throw teamFull();

      const open = await tx.teamInvite.findFirst({
        where: {
          teamId,
          revokedAt: null,
          expiresAt: { gt: new Date(now.getTime() + REUSE_MIN_LEFT_MS) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (open) return this.inviteOf(open);

      const id = randomUUID();
      const created = await tx.teamInvite.create({
        data: {
          id,
          teamId,
          createdById: userId,
          codeHash: this.codes.hash(this.codes.codeFor(id)),
          createdAt: now,
          expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS),
        },
      });
      this.logger.log(
        { teamId, inviteId: id, userId, expiresAt: iso(created.expiresAt) },
        'Invite created',
      );
      return this.inviteOf(created);
    });
  }

  /** `DELETE /team-invites/:inviteId`: by whoever made it, or the team's owner. */
  async revoke(userId: string, inviteId: string): Promise<void> {
    const notFound = () => new ApiException(404, 'NOT_FOUND', 'No such invite in your team.');
    if (!UUID.test(inviteId)) throw notFound();
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const invite = await tx.teamInvite.findUnique({ where: { id: inviteId } });
      if (!invite) throw notFound();
      await lockTeam(tx, invite.teamId);
      const membership = await tx.teamMember.findUnique({ where: { userId } });
      if (membership?.teamId !== invite.teamId) throw notFound();
      if (invite.createdById !== userId && membership.role !== 'owner') {
        throw new ApiException(
          403,
          'FORBIDDEN',
          'Only whoever made an invite, or the team owner, can turn it off.',
        );
      }
      if (invite.revokedAt) return;
      await tx.teamInvite.update({
        where: { id: inviteId },
        data: { revokedAt: now, revokedReason: 'revoked' },
      });
      this.logger.log({ teamId: invite.teamId, inviteId, userId }, 'Invite revoked');
    });
  }

  /** `POST /team-invites/preview`: the team behind a code — who and how many, nobody's progress. */
  async preview(userId: string, rawCode: string): Promise<InvitePreview> {
    const now = this.clock.now();
    try {
      const invite = await this.resolve(this.prisma, rawCode, now);
      const [team, membership] = await Promise.all([
        this.prisma.team.findUniqueOrThrow({
          where: { id: invite.teamId },
          select: { id: true, courseId: true, name: true },
        }),
        this.prisma.teamMember.findUnique({ where: { userId }, select: { teamId: true } }),
      ]);
      const roster = await loadRoster(this.prisma, team.id, team.courseId);
      const status: InvitePreviewStatus =
        membership?.teamId === team.id
          ? 'alreadyMember'
          : membership
            ? 'inAnotherTeam'
            : roster.length >= TEAM_CAPACITY
              ? 'full'
              : 'canJoin';
      const owner = roster.find((member) => member.role === 'owner') ?? roster[0];
      return {
        teamName: teamName(team.name, roster),
        ownerName: owner ? nameOf(owner) : 'Teammate',
        memberCount: roster.length,
        capacity: TEAM_CAPACITY,
        expiresAt: iso(invite.expiresAt),
        status,
      };
    } catch (error) {
      if (error instanceof ApiException) {
        this.logger.log({ userId, outcome: 'rejected', reason: error.code }, 'Invite preview');
      }
      throw error;
    }
  }

  /** `POST /team-invites/join`: joins the team behind a valid code, if it has room. */
  async join(userId: string, rawCode: string): Promise<MyTeamResponse> {
    const now = this.clock.now();
    let inviteId: string | null = null;
    try {
      const team = await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, userId);
        const invite = await this.resolve(tx, rawCode, now);
        inviteId = invite.id;
        const team = await lockTeam(tx, invite.teamId);
        if (!team) throw inviteInvalid();

        const membership = await tx.teamMember.findUnique({ where: { userId } });
        if (membership?.teamId === team.id) throw alreadyMember();
        if (membership) throw alreadyInTeam();
        const challenge = await tx.userChallenge.findUnique({
          where: { userId_courseId: { userId, courseId: team.courseId } },
          select: { id: true },
        });
        if (!challenge) throw challengeNotStarted();

        // The team's row is locked: nobody else joins or leaves until this ends.
        const taken = new Set(
          (
            await tx.teamMember.findMany({ where: { teamId: team.id }, select: { slot: true } })
          ).map((member) => member.slot),
        );
        const slot = [1, 2, 3].find((place) => !taken.has(place));
        if (slot === undefined || taken.size >= TEAM_CAPACITY) throw teamFull();
        await tx.teamMember.create({
          data: { teamId: team.id, userId, slot, role: 'member', joinedAt: now },
        });
        await tx.teamInvite.update({
          where: { id: invite.id },
          data: { useCount: { increment: 1 }, lastUsedAt: now },
        });
        this.logger.log(
          {
            teamId: team.id,
            inviteId: invite.id,
            userId,
            outcome: 'joined',
            members: taken.size + 1,
          },
          'Team join',
        );
        return this.snapshot(tx, team, userId, now);
      });
      return { team, asOf: iso(now) };
    } catch (error) {
      const failure = uniqueViolation(error) ?? error;
      if (failure instanceof ApiException) {
        this.logger.log(
          { userId, inviteId, outcome: 'rejected', reason: failure.code },
          'Team join',
        );
      }
      throw failure;
    }
  }

  /**
   * `POST /teams/:teamId/leave`. An owner who leaves hands the team to the
   * member who joined earliest; the last member to leave deletes it. The
   * invites the leaver made stop working.
   */
  async leave(userId: string, teamId: string): Promise<void> {
    if (!UUID.test(teamId)) throw teamNotFound();
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const team = await lockTeam(tx, teamId);
      const membership = await tx.teamMember.findUnique({ where: { userId } });
      if (!team || membership?.teamId !== teamId) throw teamNotFound();

      await tx.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
      await tx.teamInvite.updateMany({
        where: { teamId, createdById: userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'creatorLeft' },
      });
      const remaining = await tx.teamMember.findMany({
        where: { teamId },
        orderBy: [{ joinedAt: 'asc' }, { slot: 'asc' }],
        select: { userId: true },
      });
      const [successor] = remaining;
      if (!successor) {
        await tx.team.delete({ where: { id: teamId } });
      } else if (membership.role === 'owner') {
        await tx.teamMember.update({
          where: { teamId_userId: { teamId, userId: successor.userId } },
          data: { role: 'owner' },
        });
      }
      this.logger.log(
        {
          teamId,
          userId,
          members: remaining.length,
          teamDeleted: !successor,
          ...(successor && membership.role === 'owner' ? { ownerNow: successor.userId } : {}),
        },
        'Team left',
      );
    });
  }

  /** The invite behind a code as typed — or why there is none that works. */
  private async resolve(db: Tx, rawCode: string, now: Date) {
    const code = normalizeInviteCode(rawCode);
    if (!code) throw inviteInvalid();
    const invite = await db.teamInvite.findUnique({ where: { codeHash: this.codes.hash(code) } });
    if (!invite) throw inviteInvalid();
    if (invite.revokedAt) throw inviteRevoked();
    if (invite.expiresAt <= now) throw inviteExpired();
    return invite;
  }

  private async snapshot(
    tx: Tx,
    team: { id: string; courseId: string; name: string | null; createdAt: Date },
    viewerId: string,
    now: Date,
  ) {
    const open = await tx.teamInvite.findFirst({
      where: { teamId: team.id, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    const full = (await tx.teamMember.count({ where: { teamId: team.id } })) >= TEAM_CAPACITY;
    return teamSnapshot(tx, {
      team,
      viewerId,
      now,
      // A full team has nothing to invite to.
      invite: open && !full ? this.inviteOf(open) : null,
    });
  }

  private inviteOf(invite: {
    id: string;
    createdById: string;
    createdAt: Date;
    expiresAt: Date;
  }): TeamInvite {
    return {
      id: invite.id,
      code: this.codes.codeFor(invite.id),
      createdBy: invite.createdById,
      createdAt: iso(invite.createdAt),
      expiresAt: iso(invite.expiresAt),
    };
  }
}
