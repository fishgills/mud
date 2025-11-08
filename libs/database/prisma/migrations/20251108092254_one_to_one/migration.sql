/*
  Warnings:

  - A unique constraint covering the columns `[playerId]` on the table `SlackUser` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."SlackUser_playerId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "SlackUser_playerId_key" ON "public"."SlackUser"("playerId");
