import { z } from 'zod';

import { AchievementIdSchema } from './achievement';
import { DayNumberSchema, IdSchema, TimestampSchema } from './common';

/**
 * A small team of friends taking the same 90-day challenge (2–5 people). Not a
 * social network: no feed, no followers — only how the team's days are going.
 */

/** "MILO-7K2P": no 0/O or 1/I, so it can be read out loud. */
export const InviteCodeSchema = z.string().regex(/^MILO-[A-HJ-NP-Z2-9]{4}$/);
export type InviteCode = z.infer<typeof InviteCodeSchema>;

export const TeamSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(40),
  inviteCode: InviteCodeSchema,
  createdAt: TimestampSchema,
});
export type Team = z.infer<typeof TeamSchema>;

/**
 * Another member, as the team shares them. Their finished days are the team
 * challenge itself, so they are always there; everything else may be private
 * (`null`) — a server does not have to send it, and the UI never shows 0 for it.
 */
export const TeamMemberSchema = z.object({
  id: IdSchema,
  displayName: z.string().min(1).max(24),
  /** A remote picture later; initials until then. */
  avatarUrl: z.url().nullable(),
  /** The challenge day they joined on: earlier days are not theirs to finish. */
  joinedDay: DayNumberSchema,
  completedDays: z.array(DayNumberSchema),
  /** Quests done on `day` — `null` when not shared. */
  today: z.object({ day: DayNumberSchema, questsDone: z.number().int().nonnegative() }).nullable(),
  totalXp: z.number().int().nonnegative().nullable(),
  achievementsUnlocked: z.number().int().nonnegative().nullable(),
  lastActivityAt: TimestampSchema.nullable(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

/** Something that happened in the challenge — structured; the UI writes the words. */
const activityBase = { id: IdSchema, memberId: IdSchema, createdAt: TimestampSchema };
export const TeamActivitySchema = z.discriminatedUnion('type', [
  z.object({
    ...activityBase,
    type: z.literal('dayCompleted'),
    metadata: z.object({ day: DayNumberSchema }),
  }),
  z.object({
    ...activityBase,
    type: z.literal('streakMilestone'),
    metadata: z.object({ days: z.number().int().positive() }),
  }),
  z.object({
    ...activityBase,
    type: z.literal('achievementUnlocked'),
    metadata: z.object({ achievementId: AchievementIdSchema }),
  }),
  z.object({ ...activityBase, type: z.literal('memberJoined'), metadata: z.object({}) }),
]);
export type TeamActivity = z.infer<typeof TeamActivitySchema>;
export type TeamActivityType = TeamActivity['type'];

export const TeamInviteSchema = z.object({
  teamId: IdSchema,
  code: InviteCodeSchema,
  createdAt: TimestampSchema,
  /**
   * Whether someone on another phone can join with this code right now. The
   * local build says `false`: joining needs a server that does not exist yet.
   */
  joinable: z.boolean(),
});
export type TeamInvite = z.infer<typeof TeamInviteSchema>;

export const JoinTeamResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('joined'), team: TeamSchema }),
  z.object({ status: z.literal('alreadyMember') }),
  z.object({ status: z.literal('invalidCode') }),
  /** The code looks right, but joining another phone's team needs a server. */
  z.object({ status: z.literal('unavailable') }),
]);
export type JoinTeamResult = z.infer<typeof JoinTeamResultSchema>;
