-- CreateEnum
CREATE TYPE "public"."AchievementCategory" AS ENUM ('RAID', 'COMBAT', 'ECONOMY', 'SOCIAL', 'GUILD', 'SEASONAL', 'SECRET');

-- CreateEnum
CREATE TYPE "public"."AchievementScope" AS ENUM ('PLAYER', 'GUILD', 'SEASON');

-- CreateEnum
CREATE TYPE "public"."AchievementRewardType" AS ENUM ('NONE', 'TITLE', 'BADGE', 'TICKET', 'COSMETIC');

-- CreateEnum
CREATE TYPE "public"."AchievementConditionType" AS ENUM ('THRESHOLD', 'STREAK', 'RECORD', 'EVENT');

-- CreateTable
CREATE TABLE "public"."AchievementDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "public"."AchievementCategory" NOT NULL,
    "scope" "public"."AchievementScope" NOT NULL DEFAULT 'PLAYER',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "broadcastOnUnlock" BOOLEAN NOT NULL DEFAULT false,
    "broadcastTemplate" TEXT,
    "rewardType" "public"."AchievementRewardType" NOT NULL DEFAULT 'NONE',
    "rewardValue" TEXT,
    "conditionType" "public"."AchievementConditionType" NOT NULL DEFAULT 'THRESHOLD',
    "conditionKey" TEXT,
    "conditionValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlayerAchievementStats" (
    "playerId" INTEGER NOT NULL,
    "totalRaidsStarted" INTEGER NOT NULL DEFAULT 0,
    "totalRaidsFinished" INTEGER NOT NULL DEFAULT 0,
    "totalRaidWins" INTEGER NOT NULL DEFAULT 0,
    "totalRaidLosses" INTEGER NOT NULL DEFAULT 0,
    "maxRaidDepthReached" INTEGER NOT NULL DEFAULT 0,
    "maxRaidDepthFinished" INTEGER NOT NULL DEFAULT 0,
    "currentWinStreak" INTEGER NOT NULL DEFAULT 0,
    "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "totalDamageDealt" INTEGER NOT NULL DEFAULT 0,
    "totalDamageTaken" INTEGER NOT NULL DEFAULT 0,
    "totalKills" INTEGER NOT NULL DEFAULT 0,
    "totalCrits" INTEGER NOT NULL DEFAULT 0,
    "totalGoldEarned" INTEGER NOT NULL DEFAULT 0,
    "totalGoldSpent" INTEGER NOT NULL DEFAULT 0,
    "totalItemsPurchased" INTEGER NOT NULL DEFAULT 0,
    "totalItemsEquipped" INTEGER NOT NULL DEFAULT 0,
    "totalLegendaryItemsPurchased" INTEGER NOT NULL DEFAULT 0,
    "biggestHit" INTEGER NOT NULL DEFAULT 0,
    "lastAchievementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAchievementStats_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "public"."PlayerAchievementUnlock" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB,

    CONSTRAINT "PlayerAchievementUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkspaceBroadcastConfig" (
    "id" SERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "perPlayerCooldownSeconds" INTEGER NOT NULL DEFAULT 3600,
    "globalCooldownSeconds" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceBroadcastConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AchievementBroadcastLog" (
    "id" SERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "playerId" INTEGER NOT NULL,
    "achievementId" TEXT NOT NULL,
    "broadcastedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementBroadcastLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerAchievementUnlock_playerId_unlockedAt_idx" ON "public"."PlayerAchievementUnlock"("playerId", "unlockedAt");

-- CreateIndex
CREATE INDEX "PlayerAchievementUnlock_achievementId_idx" ON "public"."PlayerAchievementUnlock"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAchievementUnlock_playerId_achievementId_key" ON "public"."PlayerAchievementUnlock"("playerId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceBroadcastConfig_workspaceId_key" ON "public"."WorkspaceBroadcastConfig"("workspaceId");

-- CreateIndex
CREATE INDEX "AchievementBroadcastLog_workspaceId_broadcastedAt_idx" ON "public"."AchievementBroadcastLog"("workspaceId", "broadcastedAt");

-- CreateIndex
CREATE INDEX "AchievementBroadcastLog_workspaceId_playerId_broadcastedAt_idx" ON "public"."AchievementBroadcastLog"("workspaceId", "playerId", "broadcastedAt");

-- CreateIndex
CREATE INDEX "AchievementBroadcastLog_workspaceId_achievementId_broadcast_idx" ON "public"."AchievementBroadcastLog"("workspaceId", "achievementId", "broadcastedAt");

-- AddForeignKey
ALTER TABLE "public"."PlayerAchievementStats" ADD CONSTRAINT "PlayerAchievementStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerAchievementUnlock" ADD CONSTRAINT "PlayerAchievementUnlock_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerAchievementUnlock" ADD CONSTRAINT "PlayerAchievementUnlock_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "public"."AchievementDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkspaceBroadcastConfig" ADD CONSTRAINT "WorkspaceBroadcastConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AchievementBroadcastLog" ADD CONSTRAINT "AchievementBroadcastLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."WorkspaceBroadcastConfig"("workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AchievementBroadcastLog" ADD CONSTRAINT "AchievementBroadcastLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AchievementBroadcastLog" ADD CONSTRAINT "AchievementBroadcastLog_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "public"."AchievementDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
