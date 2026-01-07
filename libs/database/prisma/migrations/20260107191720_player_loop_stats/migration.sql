/*
  Warnings:

  - You are about to drop the column `healthBonus` on the `Item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Item" DROP COLUMN "healthBonus";

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "hasBattled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasMoved" BOOLEAN NOT NULL DEFAULT false;
