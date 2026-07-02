-- AlterTable
ALTER TABLE "LinkedInPost" ADD COLUMN "linkedinUrn" TEXT;
ALTER TABLE "LinkedInPost" ADD COLUMN "metricsSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LinkedInPost_userId_createdAt_idx" ON "LinkedInPost"("userId", "createdAt");
