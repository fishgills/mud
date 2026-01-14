/*
  Warnings:

  - You are about to drop the column `x` on the `CombatLog` table. All the data in the column will be lost.
  - You are about to drop the column `y` on the `CombatLog` table. All the data in the column will be lost.
  - You are about to drop the column `biomeId` on the `Monster` table. All the data in the column will be lost.
  - You are about to drop the column `lastMove` on the `Monster` table. All the data in the column will be lost.
  - You are about to drop the column `spawnedAt` on the `Monster` table. All the data in the column will be lost.
  - You are about to drop the column `x` on the `Monster` table. All the data in the column will be lost.
  - You are about to drop the column `y` on the `Monster` table. All the data in the column will be lost.
  - You are about to drop the column `isInHq` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `lastHqEnterAt` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `lastWorldX` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `lastWorldY` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `worldTileId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `x` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `y` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the `GameState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Landmark` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Npc` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WeatherState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorldItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorldSeed` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorldTile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Player" DROP CONSTRAINT "Player_worldTileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorldItem" DROP CONSTRAINT "WorldItem_itemId_fkey";

-- DropIndex
DROP INDEX "public"."Monster_isAlive_x_y_idx";

-- DropIndex
DROP INDEX "public"."Monster_x_y_idx";

-- AlterTable
ALTER TABLE "public"."CombatLog" DROP COLUMN "x",
DROP COLUMN "y";

-- AlterTable
ALTER TABLE "public"."Monster" DROP COLUMN "biomeId",
DROP COLUMN "lastMove",
DROP COLUMN "spawnedAt",
DROP COLUMN "x",
DROP COLUMN "y";

-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "isInHq",
DROP COLUMN "lastHqEnterAt",
DROP COLUMN "lastWorldX",
DROP COLUMN "lastWorldY",
DROP COLUMN "worldTileId",
DROP COLUMN "x",
DROP COLUMN "y";

-- DropTable
DROP TABLE "public"."GameState";

-- DropTable
DROP TABLE "public"."Landmark";

-- DropTable
DROP TABLE "public"."Npc";

-- DropTable
DROP TABLE "public"."WeatherState";

-- DropTable
DROP TABLE "public"."WorldItem";

-- DropTable
DROP TABLE "public"."WorldSeed";

-- DropTable
DROP TABLE "public"."WorldTile";

-- CreateIndex
CREATE INDEX "Monster_isAlive_idx" ON "public"."Monster"("isAlive");
