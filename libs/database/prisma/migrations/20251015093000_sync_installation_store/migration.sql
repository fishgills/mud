-- Manual migration generated via `prisma migrate diff`
-- Reconciles DB with current Prisma schema by removing obsolete objects and creating SlackAppInstallation table

-- AlterTable: drop legacy column if it exists
ALTER TABLE "public"."Player" DROP COLUMN IF EXISTS "isActive";

-- Drop legacy table if present
DROP TABLE IF EXISTS "public"."slack_app_installation";

-- CreateTable
CREATE TABLE "public"."SlackAppInstallation" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT,
    "appId" TEXT,
    "enterpriseId" TEXT,
    "enterpriseName" TEXT,
    "enterpriseUrl" TEXT,
    "teamId" TEXT,
    "teamName" TEXT,
    "botToken" TEXT,
    "botId" TEXT,
    "botUserId" TEXT,
    "botScopes" TEXT,
    "botRefreshToken" TEXT,
    "botTokenExpiresAt" TIMESTAMP(3),
    "userId" TEXT,
    "userToken" TEXT,
    "userScopes" TEXT,
    "userRefreshToken" TEXT,
    "userTokenExpiresAt" TIMESTAMP(3),
    "incomingWebhookUrl" TEXT,
    "incomingWebhookChannel" TEXT,
    "incomingWebhookChannelId" TEXT,
    "incomingWebhookConfigurationUrl" TEXT,
    "isEnterpriseInstall" BOOLEAN NOT NULL DEFAULT false,
    "tokenType" TEXT NOT NULL DEFAULT 'bot',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,

    CONSTRAINT "SlackAppInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlackAppInstallation_clientId_idx" ON "public"."SlackAppInstallation"("clientId");

-- CreateIndex
CREATE INDEX "SlackAppInstallation_enterpriseId_idx" ON "public"."SlackAppInstallation"("enterpriseId");

-- CreateIndex
CREATE INDEX "SlackAppInstallation_teamId_idx" ON "public"."SlackAppInstallation"("teamId");

-- CreateIndex
CREATE INDEX "SlackAppInstallation_userId_idx" ON "public"."SlackAppInstallation"("userId");

-- CreateIndex (latest-first queries)
CREATE INDEX "SlackAppInstallation_clientId_enterpriseId_teamId_userId_in_idx" ON "public"."SlackAppInstallation"("clientId", "enterpriseId", "teamId", "userId", "installedAt");
