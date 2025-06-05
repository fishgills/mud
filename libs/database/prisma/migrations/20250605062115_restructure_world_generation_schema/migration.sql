/*
  Warnings:

  - Added the required column `biomeName` to the `WorldTile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chunkX` to the `WorldTile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chunkY` to the `WorldTile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `WorldTile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `moisture` to the `WorldTile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seed` to the `WorldTile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `temperature` to the `WorldTile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `WorldTile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `WorldTile` ADD COLUMN `biomeName` VARCHAR(191) NOT NULL,
    ADD COLUMN `chunkX` INTEGER NOT NULL,
    ADD COLUMN `chunkY` INTEGER NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `height` DOUBLE NOT NULL,
    ADD COLUMN `moisture` DOUBLE NOT NULL,
    ADD COLUMN `seed` INTEGER NOT NULL,
    ADD COLUMN `temperature` DOUBLE NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `WorldSeed` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `seed` INTEGER NOT NULL,
    `heightSeed` INTEGER NOT NULL,
    `temperatureSeed` INTEGER NOT NULL,
    `moistureSeed` INTEGER NOT NULL,
    `heightScale` DOUBLE NOT NULL DEFAULT 0.01,
    `temperatureScale` DOUBLE NOT NULL DEFAULT 0.008,
    `moistureScale` DOUBLE NOT NULL DEFAULT 0.012,
    `heightOctaves` INTEGER NOT NULL DEFAULT 4,
    `temperatureOctaves` INTEGER NOT NULL DEFAULT 3,
    `moistureOctaves` INTEGER NOT NULL DEFAULT 3,
    `heightPersistence` DOUBLE NOT NULL DEFAULT 0.5,
    `temperaturePersistence` DOUBLE NOT NULL DEFAULT 0.6,
    `moisturePersistence` DOUBLE NOT NULL DEFAULT 0.4,
    `heightLacunarity` DOUBLE NOT NULL DEFAULT 2.0,
    `temperatureLacunarity` DOUBLE NOT NULL DEFAULT 2.1,
    `moistureLacunarity` DOUBLE NOT NULL DEFAULT 1.9,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorldSeed_seed_key`(`seed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `WorldTile_chunkX_chunkY_idx` ON `WorldTile`(`chunkX`, `chunkY`);

-- CreateIndex
CREATE INDEX `WorldTile_seed_idx` ON `WorldTile`(`seed`);
