-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "worldTileId" INTEGER;

-- CreateTable
CREATE TABLE "WorldTile" (
    "id" SERIAL NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "biomeId" INTEGER NOT NULL,
    "biomeName" TEXT NOT NULL,
    "description" TEXT,
    "height" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL,
    "seed" INTEGER NOT NULL,
    "chunkX" INTEGER NOT NULL,
    "chunkY" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldTile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorldTile_chunkX_chunkY_idx" ON "WorldTile"("chunkX", "chunkY");

-- CreateIndex
CREATE INDEX "WorldTile_seed_idx" ON "WorldTile"("seed");

-- CreateIndex
CREATE UNIQUE INDEX "WorldTile_x_y_key" ON "WorldTile"("x", "y");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_worldTileId_fkey" FOREIGN KEY ("worldTileId") REFERENCES "WorldTile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldTile" ADD CONSTRAINT "WorldTile_biomeId_fkey" FOREIGN KEY ("biomeId") REFERENCES "Biome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
