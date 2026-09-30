-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('android', 'ios');

-- CreateEnum
CREATE TYPE "PushKind" AS ENUM ('TEAM_MEMBER_JOINED', 'TEAM_MEMBER_COMPLETED_DAY', 'TEAM_YOUR_TURN', 'TEAM_DAY_COMPLETE', 'TEAM_STREAK_MILESTONE');

-- CreateEnum
CREATE TYPE "PushJobStatus" AS ENUM ('pending', 'sending', 'sent', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_jobs" (
    "id" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "PushKind" NOT NULL,
    "priority" SMALLINT NOT NULL,
    "teamId" UUID NOT NULL,
    "eventDate" DATE,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "PushJobStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMPTZ(3) NOT NULL,
    "lockedUntil" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "sentAt" TIMESTAMPTZ(3),

    CONSTRAINT "push_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tickets" (
    "id" TEXT NOT NULL,
    "deviceId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_sessionId_key" ON "push_devices"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");

-- CreateIndex
CREATE INDEX "push_devices_userId_idx" ON "push_devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_jobs_dedupeKey_key" ON "push_jobs"("dedupeKey");

-- CreateIndex
CREATE INDEX "push_jobs_status_runAt_idx" ON "push_jobs"("status", "runAt");

-- CreateIndex
CREATE INDEX "push_jobs_userId_teamId_eventDate_idx" ON "push_jobs"("userId", "teamId", "eventDate");

-- CreateIndex
CREATE INDEX "push_jobs_createdAt_idx" ON "push_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "push_tickets_createdAt_idx" ON "push_tickets"("createdAt");

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "refresh_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_jobs" ADD CONSTRAINT "push_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_jobs" ADD CONSTRAINT "push_jobs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tickets" ADD CONSTRAINT "push_tickets_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "push_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
