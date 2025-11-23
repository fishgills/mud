import {
  ItemQuality,
  type ItemQualityType,
  type PlayerItem,
  type Item,
  PlayerSlot,
} from '@mud/database';

export type EquippedPlayerItem = PlayerItem & { item: Item | null };

export type EquipmentTotals = {
  attackBonus: number;
  damageBonus: number;
  armorBonus: number;
  vitalityBonus: number;
  weaponDamageRoll: string | null;
};

export type EquipmentEffectDetail = {
  playerItemId: number;
  itemId: number | null;
  name: string | null;
  slot: string | null | undefined;
  quality: ItemQualityType | null | undefined;
  multiplier: number;
  base: { damageRoll: string; defense: number; health: number };
  applied: EquipmentTotals;
};

const QUALITY_MULTIPLIERS: Record<ItemQualityType, number> = {
  [ItemQuality.Trash]: 0.4,
  [ItemQuality.Poor]: 0.7,
  [ItemQuality.Common]: 1,
  [ItemQuality.Uncommon]: 1.15,
  [ItemQuality.Fine]: 1.25,
  [ItemQuality.Superior]: 1.35,
  [ItemQuality.Rare]: 1.5,
  [ItemQuality.Epic]: 1.7,
  [ItemQuality.Legendary]: 1.9,
  [ItemQuality.Mythic]: 2.1,
  [ItemQuality.Artifact]: 2.4,
  [ItemQuality.Ascended]: 2.7,
  [ItemQuality.Transcendent]: 3,
  [ItemQuality.Primal]: 3.4,
  [ItemQuality.Divine]: 3.8,
};

const getQualityMultiplier = (
  quality: ItemQualityType | null | undefined,
): number => {
  const key = quality ?? ItemQuality.Common;
  return QUALITY_MULTIPLIERS[key] ?? QUALITY_MULTIPLIERS[ItemQuality.Common];
};

export function calculateEquipmentEffects(items: EquippedPlayerItem[]): {
  totals: EquipmentTotals;
  details: EquipmentEffectDetail[];
} {
  const totals: EquipmentTotals = {
    attackBonus: 0,
    damageBonus: 0,
    armorBonus: 0,
    vitalityBonus: 0,
    weaponDamageRoll: null,
  };

  const details: EquipmentEffectDetail[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { totals, details };
  }

  for (const record of items) {
    const item = record.item;
    if (!item) continue;

    const multiplier = getQualityMultiplier(record.quality);
    const normalizedSlot = ((): string | undefined => {
      if (typeof record.slot === 'string') return record.slot;
      if (typeof item.slot === 'string') return item.slot;
      const type = typeof item.type === 'string' ? item.type.toLowerCase() : '';
      if (type === 'weapon') return PlayerSlot.weapon;
      return undefined;
    })();

    const baseDamageRoll = item.damageRoll;
    const baseDefense = item.defense ?? 0;
    const baseHealth = 0;

    const applied: EquipmentTotals = {
      attackBonus: 0,
      damageBonus: 0,
      armorBonus: 0,
      vitalityBonus: 0,
      weaponDamageRoll: null,
    };

    if (normalizedSlot === PlayerSlot.weapon && baseDamageRoll) {
      totals.weaponDamageRoll = baseDamageRoll;
      applied.weaponDamageRoll = baseDamageRoll;
    }

    // Only apply defense if it's not a weapon
    if (normalizedSlot !== PlayerSlot.weapon && baseDefense > 0) {
      const defense = Math.round(baseDefense * multiplier);
      if (defense !== 0) {
        totals.armorBonus += defense;
        applied.armorBonus = defense;
      }
    }

    // Health bonuses are disabled; no vitality is applied from items.

    details.push({
      playerItemId: record.id,
      itemId: item.id ?? null,
      name: item.name ?? null,
      slot:
        normalizedSlot ?? (typeof item.slot === 'string' ? item.slot : null),
      quality: record.quality ?? null,
      multiplier: Number(multiplier.toFixed(2)),
      base: {
        damageRoll: baseDamageRoll ?? '1d4',
        defense: baseDefense,
        health: baseHealth,
      },
      applied,
    });
  }

  return { totals, details };
}
