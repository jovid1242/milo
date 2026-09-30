import { z } from 'zod';

import { DayNumberSchema, TimestampSchema } from './common';

/**
 * A challenge team: up to three friends taking the 90 days together, kept by
 * the Milo API. Not a social network — no feed, no followers, no chat: only
 * how each member's day goes, and the team streak. The server decides all of
 * it; the app shows it and keeps the last answer for when it is offline.
 */

/** A team is full at three: the challenge is made for three friends. */
export const TEAM_CAPACITY = 3;

/** How long an invite works after it is made. */
export const INVITE_TTL_DAYS = 7;

/**
 * The characters of an invite code: none that can be mistaken for another
 * (no 0/O, no 1/I). 32 of them: five bits each.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * An invite code as people see and type it: two groups of five, `7K2PX-9QDMA`
 * — 50 random bits, short to read out, far too many to guess.
 */
export const InviteCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
export type InviteCode = z.infer<typeof InviteCodeSchema>;

export const TeamRoleSchema = z.enum(['owner', 'member']);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

/**
 * A member as the team sees them: what the challenge needs, derived by the
 * server from their progress — never their email, answers, history or
 * settings. Counts, not records.
 */
export const TeamMemberSummarySchema = z.object({
  userId: z.uuid(),
  displayName: z.string().min(1).max(40),
  /** A picture later; initials until then. */
  avatarUrl: z.url().nullable(),
  role: TeamRoleSchema,
  joinedAt: TimestampSchema,
  /** Their challenge day now, on their own calendar. */
  currentDay: DayNumberSchema,
  /** They finished `currentDay`. */
  todayCompleted: z.boolean(),
  /** Quests of `currentDay` finished so far. */
  todayQuestsDone: z.number().int().nonnegative(),
  /** Their own streak: finished days in a row. */
  streak: z.number().int().nonnegative(),
  totalXp: z.number().int().nonnegative(),
  daysCompleted: z.number().int().nonnegative(),
  achievementsUnlocked: z.number().int().nonnegative(),
  lastActivityAt: TimestampSchema.nullable(),
});
export type TeamMemberSummary = z.infer<typeof TeamMemberSummarySchema>;

/** The team streak, derived by the server from the members' finished days (see `team-streak.ts`). */
export const TeamStreakSchema = z.object({
  /** Team days in a row, up to today — or yesterday, while today is open. */
  current: z.number().int().nonnegative(),
  /** The longest run ever: what the Team Streak badge looks at. */
  longest: z.number().int().nonnegative(),
  /** Today is a team day already: everyone finished it. */
  todayComplete: z.boolean(),
});
export type TeamStreak = z.infer<typeof TeamStreakSchema>;

/** The team's open invite — shown to its members only. */
export const TeamInviteSchema = z.object({
  id: z.uuid(),
  code: InviteCodeSchema,
  createdBy: z.uuid(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
});
export type TeamInvite = z.infer<typeof TeamInviteSchema>;

/** The team as its members see it. */
export const TeamSnapshotSchema = z.object({
  id: z.uuid(),
  /** "Ada's team": teams go by their owner's name. */
  name: z.string().min(1).max(60),
  capacity: z.number().int().positive(),
  createdAt: TimestampSchema,
  /** In the order they joined — never a ranking. */
  members: z.array(TeamMemberSummarySchema).min(1).max(TEAM_CAPACITY),
  streak: TeamStreakSchema,
  /** The invite to share, while one is open. */
  invite: TeamInviteSchema.nullable(),
});
export type TeamSnapshot = z.infer<typeof TeamSnapshotSchema>;

/** `GET /teams/me` (and what creating, joining and leaving answer with). */
export const MyTeamResponseSchema = z.object({
  /** `null`: the user is in no team. */
  team: TeamSnapshotSchema.nullable(),
  /** The server's time of the answer. */
  asOf: TimestampSchema,
});
export type MyTeamResponse = z.infer<typeof MyTeamResponseSchema>;

export const TeamInviteResponseSchema = z.object({ invite: TeamInviteSchema });
export type TeamInviteResponse = z.infer<typeof TeamInviteResponseSchema>;

/** An invite code as sent: normalized by the server (any case, dashes and spaces anywhere). */
export const InviteCodeRequestSchema = z.strictObject({ code: z.string().min(1).max(64) });
export type InviteCodeRequest = z.infer<typeof InviteCodeRequestSchema>;

/**
 * What joining with this invite would mean for the user, from their side:
 * they can, the team is full, they are in it already, or in another team.
 */
export const InvitePreviewStatusSchema = z.enum([
  'canJoin',
  'full',
  'alreadyMember',
  'inAnotherTeam',
]);
export type InvitePreviewStatus = z.infer<typeof InvitePreviewStatusSchema>;

/** A team before joining it: who and how many — nobody's progress. */
export const InvitePreviewSchema = z.object({
  teamName: z.string().min(1).max(60),
  ownerName: z.string().min(1).max(40),
  memberCount: z.number().int().min(1).max(TEAM_CAPACITY),
  capacity: z.number().int().positive(),
  expiresAt: TimestampSchema,
  status: InvitePreviewStatusSchema,
});
export type InvitePreview = z.infer<typeof InvitePreviewSchema>;

export const InvitePreviewResponseSchema = z.object({ preview: InvitePreviewSchema });
export type InvitePreviewResponse = z.infer<typeof InvitePreviewResponseSchema>;
