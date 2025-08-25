import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BIOMES } from '../constants';

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

  // Removed tile persistence; tiles are computed on-the-fly

  /** Persist only settlements; tiles are computed on-the-fly and not stored. */
  async saveChunkSettlements(
    settlements: Array<{
      name: string;
      type: string;
      size: string;
      population: number;
      x: number;
      y: number;
      description: string;
    }>,
  ): Promise<void> {
    if (!settlements?.length) return;
    await this.prismaService.settlement.createMany({
      data: settlements,
      skipDuplicates: true,
    });
  }

  async getSettlementsInRadius(x: number, y: number, radius: number) {
    return await this.prismaService.settlement.findMany({
      where: {
        x: { gte: x - radius, lte: Number(x + radius) },
        y: { gte: y - radius, lte: Number(y + radius) },
      },
    });
  }

  async getSettlementsInBounds(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) {
    return await this.prismaService.settlement.findMany({
      where: {
        x: { gte: minX, lte: maxX },
        y: { gte: minY, lte: maxY },
      },
    });
  }

  async getBiomeById(biomeId: number) {
    return await this.prismaService.biome.findUnique({
      where: { id: biomeId },
    });
  }
}
