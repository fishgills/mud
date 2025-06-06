-- CreateTable
CREATE TABLE "GameState" (
    "id" SERIAL NOT NULL,
    "tick" INTEGER NOT NULL DEFAULT 0,
    "gameHour" INTEGER NOT NULL DEFAULT 0,
    "gameDay" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "slackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "worldTileId" INTEGER,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldSeed" (
    "id" SERIAL NOT NULL,
    "seed" INTEGER NOT NULL,
    "heightSeed" INTEGER NOT NULL,
    "temperatureSeed" INTEGER NOT NULL,
    "moistureSeed" INTEGER NOT NULL,
    "heightScale" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "temperatureScale" DOUBLE PRECISION NOT NULL DEFAULT 0.008,
    "moistureScale" DOUBLE PRECISION NOT NULL DEFAULT 0.012,
    "heightOctaves" INTEGER NOT NULL DEFAULT 4,
    "temperatureOctaves" INTEGER NOT NULL DEFAULT 3,
    "moistureOctaves" INTEGER NOT NULL DEFAULT 3,
    "heightPersistence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "temperaturePersistence" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "moisturePersistence" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "heightLacunarity" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "temperatureLacunarity" DOUBLE PRECISION NOT NULL DEFAULT 2.1,
    "moistureLacunarity" DOUBLE PRECISION NOT NULL DEFAULT 1.9,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldTile" (
    "id" SERIAL NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "biomeId" INTEGER NOT NULL,
    "biomeName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Biome" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Biome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "hp" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "biomeId" INTEGER NOT NULL,
    "worldTileId" INTEGER,

    CONSTRAINT "Monster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherState" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "pressure" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landmark" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Landmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_slackId_key" ON "Player"("slackId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldSeed_seed_key" ON "WorldSeed"("seed");

-- CreateIndex
CREATE INDEX "WorldTile_chunkX_chunkY_idx" ON "WorldTile"("chunkX", "chunkY");

-- CreateIndex
CREATE INDEX "WorldTile_seed_idx" ON "WorldTile"("seed");

-- CreateIndex
CREATE UNIQUE INDEX "WorldTile_x_y_key" ON "WorldTile"("x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "Biome_name_key" ON "Biome"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_x_y_key" ON "Settlement"("x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "Landmark_x_y_key" ON "Landmark"("x", "y");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_worldTileId_fkey" FOREIGN KEY ("worldTileId") REFERENCES "WorldTile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldTile" ADD CONSTRAINT "WorldTile_biomeId_fkey" FOREIGN KEY ("biomeId") REFERENCES "Biome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_biomeId_fkey" FOREIGN KEY ("biomeId") REFERENCES "Biome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_worldTileId_fkey" FOREIGN KEY ("worldTileId") REFERENCES "WorldTile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
