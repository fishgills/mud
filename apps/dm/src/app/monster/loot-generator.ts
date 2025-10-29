import { ItemQuality } from '@prisma/client';

export class LootGenerator {
  constructor() {}

  // Simple generator: always returns 0-1 drops based on a base chance
  generateForMonster(monster?: {
    level?: number;
  }): Array<{ itemId: number; quality: ItemQuality; quantity?: number }> {
    const drops: Array<{
      itemId: number;
      quality: ItemQuality;
      quantity?: number;
    }> = [];
    const level = monster?.level ?? 1;
    const baseChance = Math.min(0.6, Math.max(0.02, 0.15 + level * 0.02));
    if (Math.random() < baseChance) {
      // For now pick a placeholder itemId (to be replaced by loot table logic)
      const itemId = 1; // TODO: replace with real loot table selection
      const quality = this.rollQuality(level);
      drops.push({ itemId, quality, quantity: 1 });
    }
    return drops;
  }

  private rollQuality(level: number): ItemQuality {
    // Very simple stub: higher level increases chance of better quality
    const r = Math.random();
    if (r < 0.6) return 'Common' as ItemQuality;
    if (r < 0.85) return 'Uncommon' as ItemQuality;
    if (r < 0.95) return 'Rare' as ItemQuality;
    return 'Epic' as ItemQuality;
  }
}
