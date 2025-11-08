/*
  Warnings:

  - You are about to drop the column `clientId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `clientType` on the `Player` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Player_clientId_key";

-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "clientId",
DROP COLUMN "clientType";
