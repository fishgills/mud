/*
  Warnings:

  - You are about to drop the `SlackAppInstallation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."SlackAppInstallation";

-- CreateTable
CREATE TABLE "public"."slack_app_installation" (
    "id" SERIAL NOT NULL,
    "client_id" TEXT,
    "app_id" TEXT,
    "enterprise_id" TEXT,
    "enterprise_name" TEXT,
    "enterprise_url" TEXT,
    "team_id" TEXT,
    "team_name" TEXT,
    "bot_token" TEXT,
    "bot_id" TEXT,
    "bot_user_id" TEXT,
    "bot_scopes" TEXT,
    "bot_refresh_token" TEXT,
    "bot_token_expires_at" TIMESTAMP(3),
    "user_id" TEXT,
    "user_token" TEXT,
    "user_scopes" TEXT,
    "user_refresh_token" TEXT,
    "user_token_expires_at" TIMESTAMP(3),
    "incoming_webhook_url" TEXT,
    "incoming_webhook_channel" TEXT,
    "incoming_webhook_channel_id" TEXT,
    "incoming_webhook_configuration_url" TEXT,
    "is_enterprise_install" BOOLEAN NOT NULL DEFAULT false,
    "token_type" TEXT NOT NULL DEFAULT 'bot',
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,

    CONSTRAINT "slack_app_installation_pkey" PRIMARY KEY ("id")
);
