import { type PlayerItem, type Item, PlayerSlot } from '@mud/database';

export type EquippedPlayerItem = PlayerItem & { item: Item | null };

export type EquipmentTotals = {
  strengthBonus: number;
  agilityBonus: number;
  healthBonus: number;
  weaponDamageRoll: string | null;
};

export type EquipmentEffectDetail = {
  playerItemId: number;
  itemId: number | null;
  name: string | null;
  slot: string | null | undefined;
  base: {
    damageRoll: string;
    strengthBonus: number;
    agilityBonus: number;
    healthBonus: number;
  };
  applied: EquipmentTotals;
};

export function calculateEquipmentEffects(items: EquippedPlayerItem[]): {
  totals: EquipmentTotals;
  details: EquipmentEffectDetail[];
} {
  const totals: EquipmentTotals = {
    strengthBonus: 0,
    agilityBonus: 0,
    healthBonus: 0,
    weaponDamageRoll: null,
  };

  const details: EquipmentEffectDetail[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { totals, details };
  }

  for (const record of items) {
    const item = record.item;
    if (!item) continue;
    const normalizedSlot = ((): string | undefined => {
      if (typeof record.slot === 'string') return record.slot;
      if (typeof item.slot === 'string') return item.slot;
      const type = typeof item.type === 'string' ? item.type.toLowerCase() : '';
      if (type === 'weapon') return PlayerSlot.weapon;
      return undefined;
    })();

    const baseDamageRoll = item.damageRoll;
    const baseStrength = item.strengthBonus ?? 0;
    const baseAgility = item.agilityBonus ?? 0;
    const baseHealth = item.healthBonus ?? 0;

    const applied: EquipmentTotals = {
      strengthBonus: 0,
      agilityBonus: 0,
      healthBonus: 0,
      weaponDamageRoll: null,
    };

    if (normalizedSlot === PlayerSlot.weapon && baseDamageRoll) {
      totals.weaponDamageRoll = baseDamageRoll;
      applied.weaponDamageRoll = baseDamageRoll;
    }

    if (baseStrength !== 0) {
      totals.strengthBonus += baseStrength;
      applied.strengthBonus = baseStrength;
    }
    if (baseAgility !== 0) {
      totals.agilityBonus += baseAgility;
      applied.agilityBonus = baseAgility;
    }
    if (baseHealth !== 0) {
      totals.healthBonus += baseHealth;
      applied.healthBonus = baseHealth;
    }

    details.push({
      playerItemId: record.id,
      itemId: item.id ?? null,
      name: item.name ?? null,
      slot:
        normalizedSlot ?? (typeof item.slot === 'string' ? item.slot : null),
      base: {
        damageRoll: baseDamageRoll ?? '1d4',
        strengthBonus: baseStrength,
        agilityBonus: baseAgility,
        healthBonus: baseHealth,
      },
      applied,
    });
  }

  return { totals, details };
}
