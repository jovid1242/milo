-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "parentId" UUID;

-- CreateIndex
CREATE INDEX "refresh_tokens_parentId_idx" ON "refresh_tokens"("parentId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "refresh_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
