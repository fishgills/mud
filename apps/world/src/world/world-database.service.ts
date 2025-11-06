import { Injectable, Logger, Inject } from '@nestjs/common';
import { PlayerSlot } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
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

    // Also ensure core item templates exist in the DB
    try {
      await this.initializeItems();
    } catch (err) {
      this.logger.error('Failed to initialize items', err as Error);
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

  // Seed a small catalog of default items if they don't already exist.
  // This uses `findFirst` by name (name is not unique in the schema) so
  // it won't create duplicates if called multiple times during startup.
  async initializeItems(): Promise<void> {
    const ITEMS = [
      {
        name: 'Shortsword',
        type: 'weapon',
        description: 'A basic shortsword. Reliable and cheap.',
        value: 10,
        attack: 3,
        defense: 0,
        healthBonus: 0,
        slot: PlayerSlot.weapon,
      },
      {
        name: 'Leather Armor',
        type: 'armor',
        description: 'Simple leather armor offering light protection.',
        value: 15,
        attack: 0,
        defense: 2,
        healthBonus: 0,
        slot: PlayerSlot.chest,
      },
      {
        name: 'Health Potion',
        type: 'consumable',
        description: 'Restores a small amount of health when consumed.',
        value: 5,
        attack: 0,
        defense: 0,
        healthBonus: 20,
      },
      {
        name: 'Copper Coin',
        type: 'currency',
        description: 'A small copper coin. Used as currency.',
        value: 1,
        attack: 0,
        defense: 0,
        healthBonus: 0,
      },
    ];

    // Some test environments mock Prisma and may not provide the full
    // `item` model on the client. Guard early to avoid noisy TypeErrors.
    if (!this.prismaService || !('item' in this.prismaService)) {
      this.logger.warn(
        'Prisma client does not expose `item` model; skipping item initialization.',
      );
      return;
    }

    for (const it of ITEMS) {
      try {
        const existing = await this.prismaService.item.findFirst({
          where: { name: it.name },
        });

        if (existing) {
          this.logger.debug(`Item exists: ${it.name}`);
          continue;
        }

        // Use the Prisma-generated type for create input to avoid `any`.
        await this.prismaService.item.create({
          data: it as Prisma.ItemCreateInput,
        });
        this.logger.log(`Created item template: ${it.name}`);
      } catch (err) {
        this.logger.error(`Failed to ensure item ${it.name}`, err as Error);
      }
    }
  }
}
