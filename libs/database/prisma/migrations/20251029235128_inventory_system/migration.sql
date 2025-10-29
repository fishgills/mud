/*
  Warnings:

  - You are about to drop the column `armsItemId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `chestItemId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `headItemId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `leftHandItemId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `legsItemId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `rightHandItemId` on the `Player` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."ItemQuality" AS ENUM ('Trash', 'Poor', 'Common', 'Uncommon', 'Fine', 'Superior', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Artifact', 'Ascended', 'Transcendent', 'Primal', 'Divine');

-- CreateEnum
CREATE TYPE "public"."PlayerSlot" AS ENUM ('head', 'chest', 'arms', 'legs', 'weapon');

-- AlterTable
ALTER TABLE "public"."Item" ADD COLUMN     "slot" "public"."PlayerSlot";

-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "armsItemId",
DROP COLUMN "chestItemId",
DROP COLUMN "headItemId",
DROP COLUMN "leftHandItemId",
DROP COLUMN "legsItemId",
DROP COLUMN "rightHandItemId";

-- CreateTable
CREATE TABLE "public"."PlayerItem" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "slot" "public"."PlayerSlot",
    "quality" "public"."ItemQuality" NOT NULL DEFAULT 'Common',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorldItem" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quality" "public"."ItemQuality" NOT NULL DEFAULT 'Common',
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "spawnedByMonsterId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerItem_playerId_idx" ON "public"."PlayerItem"("playerId");

-- CreateIndex
CREATE INDEX "WorldItem_x_y_idx" ON "public"."WorldItem"("x", "y");

-- AddForeignKey
ALTER TABLE "public"."PlayerItem" ADD CONSTRAINT "PlayerItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerItem" ADD CONSTRAINT "PlayerItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorldItem" ADD CONSTRAINT "WorldItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
