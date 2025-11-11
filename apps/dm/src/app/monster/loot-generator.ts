import { ItemQuality, PrismaClient, Item } from '@mud/database';
import {
  ITEM_TEMPLATES,
  type ItemTemplateSeed,
  type ItemSpawnRarity,
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
    const template = this.pickTemplate(level);
    const quality = this.rollQuality(level);

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

  private pickTemplate(level: number): ItemTemplateSeed {
    const levelBias = Math.min(0.6, Math.max(0, (level - 1) * 0.02));
    const weighted = ITEM_TEMPLATES.map((template) => {
      const rarityRank = RARITY_PRIORITY[template.rarity] ?? 0;
      const levelBoost = 1 + levelBias * rarityRank;
      const rarityPenalty = 1 + rarityRank * 0.8;
      const weight = Math.max(
        0.05,
        (template.dropWeight / rarityPenalty) * levelBoost,
      );
      return { template, weight };
    });

    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    const roll = Math.random() * total;
    let cumulative = 0;
    for (const entry of weighted) {
      cumulative += entry.weight;
      if (roll <= cumulative) {
        return entry.template;
      }
    }
    return weighted[weighted.length - 1]?.template ?? ITEM_TEMPLATES[0];
  }

  private rollQuality(level: number): ItemQuality {
    const bias = Math.min(0.2, Math.max(0, (level - 1) * 0.01));
    const r = Math.random();
    if (r < 0.6 - bias) return 'Common';
    if (r < 0.85 - bias / 2) return 'Uncommon';
    if (r < 0.95) return 'Rare';
    if (r < 0.985) return 'Epic';
    return 'Legendary';
  }
}

const RARITY_PRIORITY: Record<ItemSpawnRarity, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
};
