import { ItemQuality, PrismaClient, Item } from '@mud/database';
import {
  ITEM_TEMPLATES,
  pickTemplateForLevel,
  rollQualityForLevel,
} from '@mud/constants';

export class LootGenerator {
  private prisma?: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma;
  }

  async generateForMonster(monster?: { level?: number }): Promise<
    Array<{
      itemId: number;
      quality: ItemQuality;
      quantity?: number;
      item?: Item | null;
    }>
  > {
    const drops: Array<{
      itemId: number;
      quality: ItemQuality;
      quantity?: number;
      item?: Item | null;
    }> = [];
    if (!ITEM_TEMPLATES.length) {
      return drops;
    }

    const level = monster?.level ?? 1;
    const template = pickTemplateForLevel(level);
    const quality = rollQualityForLevel(level);

    const record = await this.resolveItemRecord(template.name);
    if (!record) {
      // No items in the DB yet; nothing to drop.
      return drops;
    }

    drops.push({ itemId: record.id, quality, quantity: 1, item: record });
    return drops;
  }

  private async resolveItemRecord(name: string): Promise<Item | null> {
    if (!this.prisma) {
      return null;
    }

    try {
      const existing = await this.prisma.item.findFirst({
        where: { name },
      });
      if (existing) {
        return existing;
      }
      return await this.prisma.item.findFirst({ orderBy: { id: 'asc' } });
    } catch {
      return await this.prisma.item.findFirst({ orderBy: { id: 'asc' } });
    }
  }
}
