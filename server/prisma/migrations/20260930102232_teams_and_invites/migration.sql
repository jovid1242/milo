-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('owner', 'member');

-- AlterTable
ALTER TABLE "achievement_unlocks" ALTER COLUMN "mutationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "xp_ledger" ALTER COLUMN "mutationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slot" SMALLINT NOT NULL,
    "role" "TeamRole" NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedReason" TEXT,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMPTZ(3),

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_members_userId_key" ON "team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_slot_key" ON "team_members"("teamId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_codeHash_key" ON "team_invites"("codeHash");

-- CreateIndex
CREATE INDEX "team_invites_teamId_idx" ON "team_invites"("teamId");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity the application relies on, enforced by the database as well.
-- A team has three places: with (teamId, slot) unique, never a fourth member.
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_slot_check" CHECK ("slot" BETWEEN 1 AND 3);
-- One owner per team.
CREATE UNIQUE INDEX "team_members_one_owner" ON "team_members" ("teamId") WHERE "role" = 'owner';
ALTER TABLE "teams" ADD CONSTRAINT "teams_name_check" CHECK ("name" IS NULL OR char_length("name") BETWEEN 1 AND 40);
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_values_check"
  CHECK ("useCount" >= 0 AND "expiresAt" > "createdAt" AND ("revokedAt" IS NULL) = ("revokedReason" IS NULL));
