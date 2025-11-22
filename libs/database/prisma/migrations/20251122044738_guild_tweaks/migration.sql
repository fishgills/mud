/*
  Warnings:

  - You are about to drop the column `attack` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the `GuildHall` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlayerGuildState` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PlayerGuildState" DROP CONSTRAINT "PlayerGuildState_playerId_fkey";

-- AlterTable
ALTER TABLE "public"."Item" DROP COLUMN "attack",
ADD COLUMN     "damageRoll" TEXT NOT NULL DEFAULT '1d4';

-- AlterTable
ALTER TABLE "public"."Monster" ADD COLUMN     "damageRoll" TEXT NOT NULL DEFAULT '1d6';

-- DropTable
DROP TABLE "public"."GuildHall";

-- DropTable
DROP TABLE "public"."PlayerGuildState";
