-- CreateEnum
CREATE TYPE "XpReason" AS ENUM ('quest', 'examPass', 'achievement');

-- CreateEnum
CREATE TYPE "MutationStatus" AS ENUM ('accepted', 'rejected');

-- CreateTable
CREATE TABLE "user_challenges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "timeZone" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "finalAttemptId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_completions" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "questId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "questType" TEXT NOT NULL,
    "courseVersion" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "xpEarned" INTEGER NOT NULL,
    "answers" JSONB,
    "completedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mutationId" UUID NOT NULL,

    CONSTRAINT "quest_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_completions" (
    "challengeId" UUID NOT NULL,
    "day" INTEGER NOT NULL,
    "questCount" INTEGER NOT NULL,
    "xpEarned" INTEGER NOT NULL,
    "streakBefore" INTEGER NOT NULL,
    "streakAfter" INTEGER NOT NULL,
    "isPerfect" BOOLEAN NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_completions_pkey" PRIMARY KEY ("challengeId","day")
);

-- CreateTable
CREATE TABLE "learned_words" (
    "challengeId" UUID NOT NULL,
    "wordId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "learnedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "learned_words_pkey" PRIMARY KEY ("challengeId","wordId")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "attemptId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "courseVersion" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mutationId" UUID NOT NULL,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_ledger" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "XpReason" NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mutationId" UUID NOT NULL,

    CONSTRAINT "xp_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_unlocks" (
    "challengeId" UUID NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMPTZ(3) NOT NULL,
    "mutationId" UUID NOT NULL,

    CONSTRAINT "achievement_unlocks_pkey" PRIMARY KEY ("challengeId","achievementId")
);

-- CreateTable
CREATE TABLE "processed_mutations" (
    "userId" UUID NOT NULL,
    "mutationId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "MutationStatus" NOT NULL,
    "code" TEXT,
    "revision" INTEGER NOT NULL,
    "processedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_mutations_pkey" PRIMARY KEY ("userId","mutationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_challenges_userId_courseId_key" ON "user_challenges"("userId", "courseId");

-- CreateIndex
CREATE INDEX "quest_completions_challengeId_day_idx" ON "quest_completions"("challengeId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "quest_completions_challengeId_questId_key" ON "quest_completions"("challengeId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_challengeId_attemptId_key" ON "exam_attempts"("challengeId", "attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_challengeId_examId_number_key" ON "exam_attempts"("challengeId", "examId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "xp_ledger_challengeId_reason_refId_key" ON "xp_ledger"("challengeId", "reason", "refId");

-- AddForeignKey
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "user_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_completions" ADD CONSTRAINT "day_completions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "user_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learned_words" ADD CONSTRAINT "learned_words_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "user_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "user_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "user_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_unlocks" ADD CONSTRAINT "achievement_unlocks_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "user_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_mutations" ADD CONSTRAINT "processed_mutations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integrity the application relies on, enforced by the database as well.
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_revision_check" CHECK ("revision" >= 0);
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_counts_check"
  CHECK ("day" >= 1 AND "courseVersion" >= 1 AND "correctCount" >= 0 AND "correctCount" <= "totalCount" AND "xpEarned" >= 0);
ALTER TABLE "day_completions" ADD CONSTRAINT "day_completions_values_check"
  CHECK ("day" >= 1 AND "questCount" >= 1 AND "xpEarned" >= 0 AND "streakBefore" >= 0 AND "streakAfter" = "streakBefore" + 1);
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_counts_check"
  CHECK ("number" >= 1 AND "courseVersion" >= 1 AND "totalCount" >= 1 AND "correctCount" >= 0 AND "correctCount" <= "totalCount");
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_amount_check" CHECK ("amount" > 0);
ALTER TABLE "processed_mutations" ADD CONSTRAINT "processed_mutations_outcome_check"
  CHECK ("revision" >= 0 AND (("status" = 'rejected') = ("code" IS NOT NULL)));
