import { getQualityBadge, formatQualityLabel } from '@mud/constants';

export type EquipmentSlot = 'head' | 'chest' | 'legs' | 'arms' | 'weapon';

export type ItemBonuses = {
  attackBonus?: number;
  damageBonus?: number;
  armorBonus?: number;
  vitalityBonus?: number;
  weaponDamageRoll?: string | null;
};

export type InventoryItem = {
  id: number;
  itemId?: number;
  itemName?: string | null;
  quality?: string | null;
  slot?: string | null;
  equipped?: boolean;
  damageRoll?: string | null;
  defense?: number | null;
  computedBonuses?: ItemBonuses | null;
  allowedSlots?: string[];
  item?: {
    damageRoll?: string | null;
    defense?: number | null;
  } | null;
};

export type PlayerInventoryLike = {
  name?: string | null;
  level?: number | null;
  hp?: number | null;
  maxHp?: number | null;
  gold?: number | null;
  x?: number | null;
  y?: number | null;
  equipment?: Record<string, unknown> | null;
  bag?: InventoryItem[];
  isInHq?: boolean;
};

export type InventoryItemDisplay = {
  id: number;
  name: string;
  quality: string;
  qualityBadge: string;
  stats: string[];
  allowedSlots?: string[];
  equipped?: boolean;
  slot?: string | null;
};

export type EquippedSlotDisplay = {
  slot: string;
  label: string;
  item: InventoryItemDisplay | null;
};

export type InventoryModel = {
  playerName: string;
  level: number | string;
  hp: string;
  gold: number;
  position: string;
  isInGuild: boolean;
  equippedSlots: EquippedSlotDisplay[];
  backpackItems: InventoryItemDisplay[];
};

const EQUIPMENT_SLOTS: Array<{ key: EquipmentSlot; label: string }> = [
  { key: 'head', label: 'Head' },
  { key: 'chest', label: 'Chest' },
  { key: 'legs', label: 'Legs' },
  { key: 'arms', label: 'Arms' },
  { key: 'weapon', label: 'Weapon' },
];

const formatSignedStat = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value >= 0 ? `+${value}` : `${value}`;
};

const buildItemStats = (item: InventoryItem): string[] => {
  const stats: string[] = [];
  const bonuses = item.computedBonuses;
  const fallbackRoll =
    typeof item.damageRoll === 'string' && item.damageRoll.trim().length > 0
      ? item.damageRoll
      : (item.item?.damageRoll ?? null);
  const damageRoll = bonuses?.weaponDamageRoll ?? fallbackRoll;

  if (damageRoll) {
    stats.push(`Damage ${damageRoll}`);
  }

  if (bonuses) {
    if (bonuses.attackBonus) {
      stats.push(`Attack ${formatSignedStat(bonuses.attackBonus)}`);
    }
    if (bonuses.damageBonus) {
      stats.push(`Damage Bonus ${formatSignedStat(bonuses.damageBonus)}`);
    }
    if (bonuses.armorBonus) {
      stats.push(`Armor ${formatSignedStat(bonuses.armorBonus)}`);
    } else {
      const rawDefense =
        typeof item.defense === 'number' && item.defense !== 0
          ? item.defense
          : (item.item?.defense ?? null);
      if (typeof rawDefense === 'number' && rawDefense !== 0) {
        stats.push(`Armor ${formatSignedStat(rawDefense)}`);
      }
    }
  } else {
    const rawDefense =
      typeof item.defense === 'number' && item.defense !== 0
        ? item.defense
        : (item.item?.defense ?? null);
    if (typeof rawDefense === 'number' && rawDefense !== 0) {
      stats.push(`Armor ${formatSignedStat(rawDefense)}`);
    }
  }

  return stats;
};

const convertItemToDisplay = (item: InventoryItem): InventoryItemDisplay => {
  const defaultQuality = 'Common';
  const quality = item.quality ?? defaultQuality;
  const qualityLabel = formatQualityLabel(quality);
  const qualityBadge = getQualityBadge(quality);
  const name = item.itemName ?? 'Unknown Item';
  const stats = buildItemStats(item);
  const allowedSlots = Array.isArray(item.allowedSlots)
    ? item.allowedSlots
    : [];

  return {
    id: item.id,
    name,
    quality: qualityLabel,
    qualityBadge,
    stats,
    allowedSlots,
    equipped: item.equipped,
    slot: item.slot,
  };
};

export const buildInventoryModel = (
  player: PlayerInventoryLike,
): InventoryModel => {
  const equipment = player.equipment ?? {};
  const bag = player.bag ?? [];
  const bagById = new Map<number, InventoryItem>();

  bag.forEach((item) => {
    if (typeof item.id === 'number') {
      bagById.set(item.id, item);
    }
  });

  const equippedEntries = EQUIPMENT_SLOTS.map(({ key, label }) => {
    const equippedValue = equipment[key];
    let item: InventoryItem | undefined;
    let equippedId: number | null = null;

    if (equippedValue) {
      if (
        typeof equippedValue === 'object' &&
        equippedValue !== null &&
        'id' in equippedValue
      ) {
        equippedId = (equippedValue as { id: number }).id;
      } else if (typeof equippedValue === 'number') {
        equippedId = equippedValue;
      }

      if (equippedId) {
        item = bagById.get(equippedId);
      }
    }

    if (!item) {
      item = bag.find((bagItem) => bagItem.slot === key && bagItem.equipped);
    }

    return {
      slot: key,
      label,
      item: item ? convertItemToDisplay(item) : null,
    };
  });

  const equippedIds = new Set<number>();
  for (const entry of equippedEntries) {
    if (entry.item) {
      equippedIds.add(entry.item.id);
    }
  }

  const unequippedItems = bag.filter((item) => {
    if (equippedIds.has(item.id)) {
      return false;
    }
    return !(item.equipped === true);
  });

  const backpackItems = unequippedItems.map(convertItemToDisplay);

  const level = player.level ?? '?';
  const gold = player.gold ?? 0;
  const hp = player.hp ?? 0;
  const maxHp = player.maxHp ?? hp;
  const x = player.x ?? '?';
  const y = player.y ?? '?';

  return {
    playerName: player.name ?? 'Player',
    level,
    hp: `${hp}/${maxHp}`,
    gold,
    position: `${x}, ${y}`,
    isInGuild: Boolean(player.isInHq),
    equippedSlots: equippedEntries,
    backpackItems,
  };
};
