/**
 * @mud/inventory - Centralized inventory model for web and Slack
 *
 * This library provides a platform-agnostic inventory model that can be
 * rendered by both the web application and Slack bot.
 */

// Equipment slot definitions
export type EquipmentSlotKey = 'head' | 'chest' | 'legs' | 'arms' | 'weapon';

export const EQUIPMENT_SLOTS: Array<{ key: EquipmentSlotKey; label: string }> =
  [
    { key: 'head', label: 'Head' },
    { key: 'chest', label: 'Chest' },
    { key: 'legs', label: 'Legs' },
    { key: 'arms', label: 'Arms' },
    { key: 'weapon', label: 'Weapon' },
  ];

// Types for computed bonuses from equipment
export type EquipmentBonuses = {
  attackBonus?: number;
  damageBonus?: number;
  armorBonus?: number;
  vitalityBonus?: number;
  weaponDamageRoll?: string | null;
};

// Input type for an item (flexible to handle different sources)
export type InventoryItemInput = {
  id?: number | null;
  itemId?: number | null;
  itemName?: string | null;
  name?: string | null;
  quality?: string | null;
  quantity?: number | null;
  rank?: number | null;
  equipped?: boolean;
  slot?: string | null;
  allowedSlots?: string[];
  damageRoll?: string | null;
  defense?: number | null;
  value?: number | null;
  description?: string | null;
  itemType?: string | null;
  computedBonuses?: EquipmentBonuses | null;
  item?: {
    name?: string | null;
    damageRoll?: string | null;
    defense?: number | null;
    description?: string | null;
    slot?: string | null;
    value?: number | null;
  } | null;
};

// Input type for equipment mapping (can be id or object with id/quality)
export type EquipmentSlotValue =
  | number
  | { id: number; quality?: string | null }
  | null
  | undefined;

export type EquipmentMap = Partial<
  Record<EquipmentSlotKey, EquipmentSlotValue>
>;

// Input type for player inventory data
export type PlayerInventoryInput = {
  name?: string | null;
  level?: number | null;
  hp?: number | null;
  maxHp?: number | null;
  gold?: number | null;
  x?: number | null;
  y?: number | null;
  isInHq?: boolean;
  equipment?: EquipmentMap | null;
  bag?: InventoryItemInput[] | null;
  // Alternative: items directly on player
  items?: InventoryItemInput[] | null;
};

// Computed stat line for an item
export type ItemStatLine = {
  label: string;
  value: string;
};

// Processed item for display
export type InventoryItem = {
  id: number | null;
  name: string;
  qualityLabel: string;
  qualityBadge: string;
  quality: string;
  quantity: number;
  rank: number | null;
  equipped: boolean;
  slot: string | null;
  allowedSlots: string[];
  canEquip: boolean;
  stats: ItemStatLine[];
  value: number | null;
  description: string | null;
  itemType: string | null;
};

// Equipped slot for display
export type EquippedSlot = {
  key: EquipmentSlotKey;
  label: string;
  item: InventoryItem | null;
  isEmpty: boolean;
};

// Full inventory model for rendering
export type InventoryModel = {
  playerName: string;
  level: number | null;
  hp: number | null;
  maxHp: number | null;
  gold: number;
  position: { x: number | null; y: number | null };
  isInGuild: boolean;
  equippedSlots: EquippedSlot[];
  backpackItems: InventoryItem[];
  totalEquipped: number;
  totalBackpack: number;
};

// Quality badge and label helpers
const QUALITY_BADGES: Record<string, string> = {
  Common: '⚪',
  Uncommon: '🟢',
  Rare: '🔵',
  Epic: '🟣',
  Legendary: '🟠',
};

const QUALITY_LABELS: Record<string, string> = {
  Common: 'Common',
  Uncommon: 'Uncommon',
  Rare: 'Rare',
  Epic: 'Epic',
  Legendary: 'Legendary',
};

const getQualityBadge = (quality: string | null | undefined): string => {
  return QUALITY_BADGES[quality ?? 'Common'] ?? '⚪';
};

const getQualityLabel = (quality: string | null | undefined): string => {
  return QUALITY_LABELS[quality ?? 'Common'] ?? 'Common';
};

const formatSignedStat = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value >= 0 ? `+${value}` : `${value}`;
};

const buildItemStats = (item: InventoryItemInput): ItemStatLine[] => {
  const stats: ItemStatLine[] = [];
  const bonuses = item.computedBonuses;

  // Damage roll for weapons
  const fallbackRoll =
    typeof item.damageRoll === 'string' && item.damageRoll.trim().length > 0
      ? item.damageRoll
      : (item.item?.damageRoll ?? null);
  const damageRoll = bonuses?.weaponDamageRoll ?? fallbackRoll;
  if (damageRoll) {
    stats.push({ label: 'Damage', value: damageRoll });
  }

  if (bonuses) {
    if (bonuses.attackBonus) {
      stats.push({
        label: 'Attack',
        value: formatSignedStat(bonuses.attackBonus),
      });
    }
    if (bonuses.damageBonus) {
      stats.push({
        label: 'Damage Bonus',
        value: formatSignedStat(bonuses.damageBonus),
      });
    }
    if (bonuses.armorBonus) {
      stats.push({
        label: 'Armor',
        value: formatSignedStat(bonuses.armorBonus),
      });
    } else {
      const rawDefense =
        typeof item.defense === 'number' && item.defense !== 0
          ? item.defense
          : (item.item?.defense ?? null);
      if (typeof rawDefense === 'number' && rawDefense !== 0) {
        stats.push({ label: 'Armor', value: formatSignedStat(rawDefense) });
      }
    }
  } else {
    const rawDefense =
      typeof item.defense === 'number' && item.defense !== 0
        ? item.defense
        : (item.item?.defense ?? null);
    if (typeof rawDefense === 'number' && rawDefense !== 0) {
      stats.push({ label: 'Armor', value: formatSignedStat(rawDefense) });
    }
  }

  return stats;
};

const resolveItemId = (item: InventoryItemInput): number | null => {
  const id = item.id;
  return typeof id === 'number' ? id : null;
};

const resolveItemName = (item: InventoryItemInput): string => {
  return item.itemName ?? item.name ?? item.item?.name ?? 'Unknown Item';
};

const processItem = (item: InventoryItemInput): InventoryItem => {
  const quality = item.quality ?? 'Common';
  const allowedSlots: string[] = Array.isArray(item.allowedSlots)
    ? item.allowedSlots
    : item.item?.slot
      ? [item.item.slot]
      : [];

  return {
    id: resolveItemId(item),
    name: resolveItemName(item),
    qualityLabel: getQualityLabel(quality),
    qualityBadge: getQualityBadge(quality),
    quality,
    quantity: item.quantity ?? 1,
    rank: item.rank ?? null,
    equipped: item.equipped === true,
    slot: item.slot ?? null,
    allowedSlots,
    canEquip: allowedSlots.length > 0,
    stats: buildItemStats(item),
    value: item.value ?? item.item?.value ?? null,
    description: item.description ?? item.item?.description ?? null,
    itemType: item.itemType ?? null,
  };
};

const resolveEquippedItemId = (
  value: EquipmentSlotValue,
): number | undefined => {
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object' && 'id' in value) {
    return value.id;
  }
  return undefined;
};

/**
 * Build a platform-agnostic inventory model from player data.
 *
 * @param player - Player inventory data (from API or database)
 * @returns InventoryModel ready for rendering in web or Slack
 */
export const buildInventoryModel = (
  player: PlayerInventoryInput,
): InventoryModel => {
  const equipment = player.equipment ?? {};
  const bag = player.bag ?? player.items ?? [];

  // Build lookup for items by ID
  const bagById = new Map<number, InventoryItemInput>();
  bag.forEach((item) => {
    const id = resolveItemId(item);
    if (id !== null) {
      bagById.set(id, item);
    }
  });

  // Track which items are equipped
  const equippedIds = new Set<number>();

  // Process equipped slots
  const equippedSlots: EquippedSlot[] = EQUIPMENT_SLOTS.map(
    ({ key, label }) => {
      const equippedValue = equipment[key];
      const equippedId = resolveEquippedItemId(equippedValue);
      let itemInput: InventoryItemInput | undefined;

      if (equippedId !== undefined) {
        itemInput = bagById.get(equippedId);
        equippedIds.add(equippedId);
      }

      // Fallback: look for item with matching slot and equipped=true
      if (!itemInput) {
        itemInput = bag.find(
          (bagItem) => bagItem.slot === key && bagItem.equipped === true,
        );
        if (itemInput) {
          const id = resolveItemId(itemInput);
          if (id !== null) {
            equippedIds.add(id);
          }
        }
      }

      return {
        key,
        label,
        item: itemInput ? processItem(itemInput) : null,
        isEmpty: !itemInput,
      };
    },
  );

  // Process backpack (unequipped items)
  const backpackItems: InventoryItem[] = bag
    .filter((item) => {
      const id = resolveItemId(item);
      if (id !== null && equippedIds.has(id)) {
        return false;
      }
      return item.equipped !== true;
    })
    .map(processItem);

  return {
    playerName: player.name ?? 'Unknown',
    level: player.level ?? null,
    hp: player.hp ?? null,
    maxHp: player.maxHp ?? null,
    gold: player.gold ?? 0,
    position: {
      x: player.x ?? null,
      y: player.y ?? null,
    },
    isInGuild: player.isInHq === true,
    equippedSlots,
    backpackItems,
    totalEquipped: equippedSlots.filter((s) => !s.isEmpty).length,
    totalBackpack: backpackItems.length,
  };
};

// Re-export quality helpers for external use
export { getQualityBadge, getQualityLabel };
