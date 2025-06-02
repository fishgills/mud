/*
  Warnings:

  - You are about to drop the column `z` on the `Monster` table. All the data in the column will be lost.
  - You are about to drop the column `z` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `z` on the `WorldTile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[x,y]` on the table `WorldTile` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `WorldTile_x_y_z_key` ON `WorldTile`;

-- AlterTable
ALTER TABLE `Monster` DROP COLUMN `z`;

-- AlterTable
ALTER TABLE `Player` DROP COLUMN `z`;

-- AlterTable
ALTER TABLE `WorldTile` DROP COLUMN `z`;

-- CreateIndex
CREATE UNIQUE INDEX `WorldTile_x_y_key` ON `WorldTile`(`x`, `y`);
