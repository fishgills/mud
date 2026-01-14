/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Player` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "public"."RunType" AS ENUM ('SOLO', 'GUILD');

-- CreateEnum
CREATE TYPE "public"."RunStatus" AS ENUM ('ACTIVE', 'CASHED_OUT', 'FAILED');

-- AlterTable
ALTER TABLE "public"."Player" ALTER COLUMN "name" SET DATA TYPE CITEXT;

-- CreateTable
CREATE TABLE "public"."Guild" (
    "id" SERIAL NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" CITEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuildMember" (
    "id" SERIAL NOT NULL,
    "guildId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuildInvite" (
    "id" SERIAL NOT NULL,
    "guildId" INTEGER NOT NULL,
    "inviterPlayerId" INTEGER NOT NULL,
    "inviteePlayerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Run" (
    "id" SERIAL NOT NULL,
    "runType" "public"."RunType" NOT NULL,
    "status" "public"."RunStatus" NOT NULL DEFAULT 'ACTIVE',
    "round" INTEGER NOT NULL DEFAULT 0,
    "bankedXp" INTEGER NOT NULL DEFAULT 0,
    "bankedGold" INTEGER NOT NULL DEFAULT 0,
    "difficultyTier" INTEGER NOT NULL DEFAULT 1,
    "leaderPlayerId" INTEGER NOT NULL,
    "guildId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RunParticipant" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Guild_teamId_idx" ON "public"."Guild"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_teamId_name_key" ON "public"."Guild"("teamId", "name");

-- CreateIndex
CREATE INDEX "GuildMember_guildId_idx" ON "public"."GuildMember"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_guildId_playerId_key" ON "public"."GuildMember"("guildId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_playerId_key" ON "public"."GuildMember"("playerId");

-- CreateIndex
CREATE INDEX "GuildInvite_inviteePlayerId_idx" ON "public"."GuildInvite"("inviteePlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildInvite_guildId_inviteePlayerId_key" ON "public"."GuildInvite"("guildId", "inviteePlayerId");

-- CreateIndex
CREATE INDEX "Run_status_idx" ON "public"."Run"("status");

-- CreateIndex
CREATE INDEX "Run_leaderPlayerId_idx" ON "public"."Run"("leaderPlayerId");

-- CreateIndex
CREATE INDEX "Run_guildId_idx" ON "public"."Run"("guildId");

-- CreateIndex
CREATE INDEX "RunParticipant_playerId_idx" ON "public"."RunParticipant"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RunParticipant_runId_playerId_key" ON "public"."RunParticipant"("runId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "public"."Player"("name");

-- AddForeignKey
ALTER TABLE "public"."GuildMember" ADD CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuildMember" ADD CONSTRAINT "GuildMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuildInvite" ADD CONSTRAINT "GuildInvite_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuildInvite" ADD CONSTRAINT "GuildInvite_inviterPlayerId_fkey" FOREIGN KEY ("inviterPlayerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuildInvite" ADD CONSTRAINT "GuildInvite_inviteePlayerId_fkey" FOREIGN KEY ("inviteePlayerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Run" ADD CONSTRAINT "Run_leaderPlayerId_fkey" FOREIGN KEY ("leaderPlayerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Run" ADD CONSTRAINT "Run_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RunParticipant" ADD CONSTRAINT "RunParticipant_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RunParticipant" ADD CONSTRAINT "RunParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
