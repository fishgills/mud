import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BIOMES } from '../constants';
import { ChunkData } from './types';
import { WorldTile } from '@prisma/client';

@Injectable()
export class WorldDatabaseService {
  private readonly logger = new Logger(WorldDatabaseService.name);

  constructor(@Inject(PrismaService) private prismaService: PrismaService) {}

  async initializeBiomes(): Promise<void> {
    for (const biome of Object.values(BIOMES)) {
      await this.prismaService.biome.upsert({
        where: { id: biome.id },
        update: { name: biome.name },
        create: { id: biome.id, name: biome.name },
      });
    }
  }

  async loadWorldSeed(): Promise<number> {
    const activeSeed = await this.prismaService.worldSeed.findFirst({
      where: { isActive: true },
    });

    if (activeSeed) {
      this.logger.log(`Loaded active world seed: ${activeSeed.seed}`);
      return activeSeed.seed;
    }

    // Create new seed
    const newSeed = Math.floor(Math.random() * 1000000);
    await this.prismaService.worldSeed.create({
      data: {
        seed: newSeed,
        heightSeed: newSeed,
        temperatureSeed: newSeed + 1000,
        moistureSeed: newSeed + 2000,
      },
    });

    this.logger.log(`Created new world seed: ${newSeed}`);
    return newSeed;
  }

  async getChunkFromDatabase(
    chunkX: number,
    chunkY: number,
  ): Promise<WorldTile[]> {
    return await this.prismaService.worldTile.findMany({
      where: {
        x: chunkX,
        y: chunkY,
      },
      include: { biome: true },
    });
  }

  async getTileFromDatabase(x: number, y: number): Promise<WorldTile | null> {
    return await this.prismaService.worldTile.findUnique({
      where: {
        x_y: { x, y },
      },
      include: { biome: true },
    });
  }

  async saveChunkToDatabase(
    chunkData: ChunkData,
    currentSeed: number,
  ): Promise<void> {
    // Save tiles
    const tileData = chunkData.tiles.map((tile) => ({
      x: tile.x,
      y: tile.y,
      biomeId: tile.biomeId,
      biomeName: tile.biomeName,
      height: tile.height,
      temperature: tile.temperature,
      moisture: tile.moisture,
      seed: currentSeed,
      chunkX: Math.floor(tile.x / 50),
      chunkY: Math.floor(tile.y / 50),
    }));

    await this.prismaService.worldTile.createMany({
      data: tileData,
      skipDuplicates: true,
    });

    // Save settlements
    const settlementData = chunkData.settlements.map((settlement) => ({
      name: settlement.name,
      type: settlement.type,
      size: settlement.size,
      population: settlement.population,
      x: settlement.x,
      y: settlement.y,
      description: settlement.description,
    }));

    if (settlementData.length > 0) {
      await this.prismaService.settlement.createMany({
        data: settlementData,
        skipDuplicates: true,
      });
    }
  }

  async getSettlementsInRadius(x: number, y: number, radius: number) {
    return await this.prismaService.settlement.findMany({
      where: {
        x: { gte: x - radius, lte: Number(x + radius) },
        y: { gte: y - radius, lte: Number(y + radius) },
      },
    });
  }

  async updateTileDescription(
    x: number,
    y: number,
    description: string,
  ): Promise<WorldTile | null> {
    const updatedTile = await this.prismaService.worldTile.update({
      where: {
        x_y: { x, y },
      },
      data: {
        description,
      },
      include: { biome: true },
    });

    return updatedTile;
  }
}
