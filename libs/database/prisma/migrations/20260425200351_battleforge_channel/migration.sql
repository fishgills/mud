-- AlterTable
ALTER TABLE "public"."SlackUser" ADD COLUMN     "battleforgePromptDeclined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inBattleforgeChannel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastBattleforgePromptAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Workspace" ADD COLUMN     "battleforgeChannelId" TEXT;
