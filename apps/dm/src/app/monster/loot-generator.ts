import { ItemQuality, PrismaClient, Item } from '@mud/database';

export class LootGenerator {
  private prisma?: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma;
  }

  // Simple generator: always returns 0-1 drops based on a base chance
  // Now async so it can optionally look up the Item record for the
  // chosen itemId and include it in the returned drop object.
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
    const level = monster?.level ?? 1;
    // const baseChance = Math.min(0.6, Math.max(0.02, 0.15 + level * 0.02));
    // if (Math.random() < baseChance) {
    // For now pick a placeholder itemId (to be replaced by loot table logic)
    const itemId = 1; // TODO: replace with real loot table selection
    const quality = this.rollQuality(level);

    let item: Item | null | undefined = undefined;
    if (this.prisma) {
      try {
        item = await this.prisma.item.findUnique({ where: { id: itemId } });
      } catch {
        // Don't fail generation if DB lookup fails; caller will log if needed.
        item = null;
      }
    }

    drops.push({ itemId, quality, quantity: 1, item });
    // }
    return drops;
  }

  private rollQuality(level: number): ItemQuality {
    // Slightly bias quality towards better tiers at higher monster levels.
    const bias = Math.min(0.2, Math.max(0, (level - 1) * 0.01));
    const r = Math.random();
    if (r < 0.6 - bias) return 'Common' as ItemQuality;
    if (r < 0.85 - bias / 2) return 'Uncommon' as ItemQuality;
    if (r < 0.95) return 'Rare' as ItemQuality;
    return 'Epic' as ItemQuality;
  }
}
