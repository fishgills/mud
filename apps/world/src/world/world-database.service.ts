import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@mud/database';
import { BIOMES } from '../constants';
import { ITEM_TEMPLATES, type ItemTemplateSeed } from '@mud/constants';

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

  async getBiomeById(biomeId: number) {
    return await this.prismaService.biome.findUnique({
      where: { id: biomeId },
    });
  }

  // Seed a small catalog of default items if they don't already exist.
  // This uses `findFirst` by name (name is not unique in the schema) so
  // it won't create duplicates if called multiple times during startup.
  async initializeItems(): Promise<void> {
    // Some test environments mock Prisma and may not provide the full
    // `item` model on the client. Guard early to avoid noisy TypeErrors.
    if (!this.prismaService || !('item' in this.prismaService)) {
      this.logger.warn(
        'Prisma client does not expose `item` model; skipping item initialization.',
      );
      return;
    }

    for (const template of ITEM_TEMPLATES) {
      try {
        const existing = await this.prismaService.item.findFirst({
          where: { name: template.name },
        });

        if (existing) {
          this.logger.debug(`Item exists: ${template.name}`);
          continue;
        }

        const createInput = this.buildItemCreateInput(template);
        await this.prismaService.item.create({ data: createInput });
        this.logger.log(
          `Created item template: ${template.name} [${template.rarity}]`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to ensure item ${template.name}`,
          err as Error,
        );
      }
    }
  }

  private buildItemCreateInput(
    template: ItemTemplateSeed,
  ): Prisma.ItemUncheckedCreateInput {
    const data: Prisma.ItemUncheckedCreateInput = {
      name: template.name,
      type: template.type,
      description: template.description,
      value: template.value,
      damageRoll: template.damageRoll ?? undefined,
      defense: template.defense ?? undefined,
      slot: template.slot ?? undefined,
      rank: template.rank ?? undefined,
    };
    return data;
  }
}
