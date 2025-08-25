/*
  Warnings:

  - You are about to drop the column `worldTileId` on the `Monster` table. All the data in the column will be lost.
  - You are about to drop the column `worldTileId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the `WorldTile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Monster" DROP CONSTRAINT "Monster_worldTileId_fkey";

-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_worldTileId_fkey";

-- DropForeignKey
ALTER TABLE "WorldTile" DROP CONSTRAINT "WorldTile_biomeId_fkey";

-- AlterTable
ALTER TABLE "Monster" DROP COLUMN "worldTileId";

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "worldTileId";

-- DropTable
DROP TABLE "WorldTile";
