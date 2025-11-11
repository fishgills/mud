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
  hpBonus: number;
};

export type EquipmentEffectDetail = {
  playerItemId: number;
  itemId: number | null;
  name: string | null;
  slot: string | null | undefined;
  quality: ItemQualityType | null | undefined;
  multiplier: number;
  base: { attack: number; defense: number; health: number };
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
    hpBonus: 0,
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

    const baseAttack = item.attack ?? 0;
    const baseDefense = item.defense ?? 0;
    const baseHealth = item.healthBonus ?? 0;

    const applied: EquipmentTotals = {
      attackBonus: 0,
      damageBonus: 0,
      armorBonus: 0,
      hpBonus: 0,
    };

    if (normalizedSlot === PlayerSlot.weapon && baseAttack > 0) {
      const scaledAttack = baseAttack * multiplier;
      const scaledToHit = baseAttack * multiplier * 0.5;
      const toHit = scaledToHit > 0 ? Math.max(1, Math.round(scaledToHit)) : 0;
      const damage =
        scaledAttack > 0 ? Math.max(1, Math.round(scaledAttack)) : 0;
      if (toHit !== 0) {
        totals.attackBonus += toHit;
        applied.attackBonus = toHit;
      }
      if (damage !== 0) {
        totals.damageBonus += damage;
        applied.damageBonus = damage;
      }
    }

    if (normalizedSlot !== PlayerSlot.weapon && baseDefense > 0) {
      const defense = Math.round(baseDefense * multiplier);
      if (defense !== 0) {
        totals.armorBonus += defense;
        applied.armorBonus = defense;
      }
    }

    if (baseHealth > 0) {
      const health = Math.round(baseHealth * multiplier);
      if (health !== 0) {
        totals.hpBonus += health;
        applied.hpBonus = health;
      }
    }

    details.push({
      playerItemId: record.id,
      itemId: item.id ?? null,
      name: item.name ?? null,
      slot:
        normalizedSlot ?? (typeof item.slot === 'string' ? item.slot : null),
      quality: record.quality ?? null,
      multiplier: Number(multiplier.toFixed(2)),
      base: { attack: baseAttack, defense: baseDefense, health: baseHealth },
      applied,
    });
  }

  return { totals, details };
}
