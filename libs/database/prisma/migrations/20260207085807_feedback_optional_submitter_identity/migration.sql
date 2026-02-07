-- AlterTable
ALTER TABLE "public"."Feedback" ADD COLUMN     "submitterTeamId" TEXT,
ADD COLUMN     "submitterUserId" TEXT,
ALTER COLUMN "playerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Feedback_submitterTeamId_submitterUserId_idx" ON "public"."Feedback"("submitterTeamId", "submitterUserId");
