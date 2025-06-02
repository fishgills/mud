/*
  Warnings:

  - A unique constraint covering the columns `[x,y,z]` on the table `WorldTile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `WorldTile_x_y_z_key` ON `WorldTile`(`x`, `y`, `z`);
