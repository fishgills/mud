/*
  Warnings:

  - You are about to drop the column `slackId` on the `Player` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Player_slackId_key";

-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "slackId";
