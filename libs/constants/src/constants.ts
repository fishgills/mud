import { ItemType, ItemQuality, PlayerSlot } from '@mud/database';
import type { ItemQualityType } from '@mud/database';

export const WORLD_CHUNK_SIZE = 50;

export const getXpThresholdForLevel = (level: number): number =>
  Math.floor((100 * (level * (level + 1))) / 2);

export const getXpToNextLevel = (level: number, currentXp: number): number =>
  Math.max(0, getXpThresholdForLevel(level) - currentXp);

// Quality badging helpers for UI rendering. Keys match the Prisma ItemQuality
// enum string names to keep the mapping stable with the backend.
export const QUALITY_BADGES: Record<string, string> = {
  Trash: '⬛',
  Poor: '⚫',
  Common: '⚪',
  Uncommon: '🟢',
  Fine: '🔹',
  Superior: '🔷',
  Rare: '🔵',
  Epic: '🟣',
  Legendary: '🟠',
  Mythic: '🔥',
  Artifact: '✨',
  Ascended: '🌟',
  Transcendent: '💠',
  Primal: '🛡️',
  Divine: '👑',
};

/**
 * Return the badge emoji for a given quality. Accepts either the enum string
 * or a lower/upper-cased variant.
 */
export function getQualityBadge(quality: string | undefined): string {
  const DEFAULT = QUALITY_BADGES['Common'];
  if (!quality) return DEFAULT;
  const q = String(quality);
  // Prefer exact match
  if (QUALITY_BADGES[q]) return QUALITY_BADGES[q];
  // Try normalized form (capitalize first letter)
  const norm = q[0].toUpperCase() + q.slice(1).toLowerCase();
  return QUALITY_BADGES[norm] ?? DEFAULT;
}

export function formatQualityLabel(quality: string | undefined): string {
  if (!quality) return 'Common';
  const q = String(quality);
  if (QUALITY_BADGES[q]) return q;
  const norm = q[0].toUpperCase() + q.slice(1).toLowerCase();
  return QUALITY_BADGES[norm] ? norm : 'Common';
}

export type ItemSpawnRarity = ItemQualityType;

export const ITEM_QUALITY_ORDER: ItemQualityType[] = [
  ItemQuality.Trash,
  ItemQuality.Poor,
  ItemQuality.Common,
  ItemQuality.Uncommon,
  ItemQuality.Fine,
  ItemQuality.Superior,
  ItemQuality.Rare,
  ItemQuality.Epic,
  ItemQuality.Legendary,
  ItemQuality.Mythic,
  ItemQuality.Artifact,
  ItemQuality.Ascended,
  ItemQuality.Transcendent,
  ItemQuality.Primal,
  ItemQuality.Divine,
];

export const ITEM_QUALITY_PRIORITY: Record<ItemQualityType, number> =
  ITEM_QUALITY_ORDER.reduce(
    (acc, quality, index) => {
      acc[quality] = index;
      return acc;
    },
    {} as Record<ItemQualityType, number>,
  );

export interface ItemTemplateSeed {
  name: string;
  type: ItemType;
  description: string;
  value: number;
  attack?: number;
  defense?: number;
  healthBonus?: number;
  slot?: PlayerSlot;
  rarity: ItemSpawnRarity;
  dropWeight: number;
}

export const ITEM_TEMPLATES: ItemTemplateSeed[] = [
  {
    name: 'Rusty Dagger',
    type: ItemType.WEAPON,
    description: 'A pitted dagger favored by desperate highwaymen.',
    value: 4,
    attack: 2,
    rarity: 'Common',
    dropWeight: 11,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Shortsword',
    type: ItemType.WEAPON,
    description: 'A basic shortsword. Reliable and cheap.',
    value: 10,
    attack: 3,
    rarity: 'Common',
    dropWeight: 9,
    slot: PlayerSlot.weapon,
  },
  {
    name: "Traveler's Cloak",
    type: ItemType.ARMOR,
    description:
      'A weathered cloak that offers modest protection from the elements.',
    value: 8,
    defense: 1,
    rarity: 'Common',
    dropWeight: 10,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Leather Boots',
    type: ItemType.ARMOR,
    description: 'Soft boots that keep the dust off your feet.',
    value: 6,
    defense: 1,
    rarity: 'Common',
    dropWeight: 10,
    slot: PlayerSlot.legs,
  },
  {
    name: 'Oak Staff',
    type: ItemType.WEAPON,
    description: 'A sturdy staff engraved with simple runes.',
    value: 12,
    attack: 2,
    healthBonus: 5,
    rarity: 'Common',
    dropWeight: 8,
    slot: PlayerSlot.weapon,
  },

  {
    name: 'Tempered Longsword',
    type: ItemType.WEAPON,
    description: 'A well-balanced blade favored by veteran guards.',
    value: 35,
    attack: 5,
    rarity: 'Uncommon',
    dropWeight: 6,
    slot: PlayerSlot.weapon,
  },
  {
    name: "Hunter's Recurve Bow",
    type: ItemType.WEAPON,
    description: 'Curved limbs deliver a powerful, silent shot.',
    value: 32,
    attack: 4,
    rarity: 'Uncommon',
    dropWeight: 5,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Reinforced Leather',
    type: ItemType.ARMOR,
    description: 'Layered hide stitched over chain links.',
    value: 30,
    defense: 4,
    rarity: 'Uncommon',
    dropWeight: 5,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Ember Wand',
    type: ItemType.WEAPON,
    description: 'Warm to the touch and eager to spit sparks.',
    value: 34,
    attack: 3,
    healthBonus: 5,
    rarity: 'Uncommon',
    dropWeight: 4,
    slot: PlayerSlot.weapon,
  },

  {
    name: "Stormcaller's Blade",
    type: ItemType.WEAPON,
    description: 'Crackles with barely contained lightning.',
    value: 85,
    attack: 7,
    rarity: 'Rare',
    dropWeight: 2.5,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Frostguard Plate',
    type: ItemType.ARMOR,
    description: 'Heavy plate lined with glimmering frostglass.',
    value: 90,
    defense: 6,
    rarity: 'Rare',
    dropWeight: 2.3,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Shadowstep Boots',
    type: ItemType.ARMOR,
    description: 'Silent leather that seems to blur at the edges.',
    value: 70,
    defense: 3,
    healthBonus: 10,
    rarity: 'Rare',
    dropWeight: 2.8,
    slot: PlayerSlot.legs,
  },

  {
    name: 'Dragonsoul Greatsword',
    type: ItemType.WEAPON,
    description: 'Forged from the bones of an ancient wyrm.',
    value: 150,
    attack: 12,
    rarity: 'Epic',
    dropWeight: 1.2,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Umbral Shroud',
    type: ItemType.ARMOR,
    description: 'A mantle that drinks in the light around it.',
    value: 140,
    defense: 5,
    healthBonus: 20,
    rarity: 'Epic',
    dropWeight: 1,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Celestial Scepter',
    type: ItemType.WEAPON,
    description: 'Stars wink within the crystal atop this staff.',
    value: 145,
    attack: 8,
    healthBonus: 15,
    rarity: 'Epic',
    dropWeight: 0.9,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Worldrender Halberd',
    type: ItemType.WEAPON,
    description: 'Said to have split a continent in mythic wars.',
    value: 250,
    attack: 16,
    rarity: 'Legendary',
    dropWeight: 0.45,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Crown of the First Flame',
    type: ItemType.ARMOR,
    description: 'An ornate circlet that glows with eternal fire.',
    value: 220,
    defense: 4,
    healthBonus: 25,
    rarity: 'Legendary',
    dropWeight: 0.4,
    slot: PlayerSlot.head,
  },
];

export const ITEM_RARITY_LOOKUP: Record<
  string,
  { rarity: ItemSpawnRarity; dropWeight: number }
> = ITEM_TEMPLATES.reduce(
  (acc, template) => {
    acc[template.name] = {
      rarity: template.rarity,
      dropWeight: template.dropWeight,
    };
    return acc;
  },
  {} as Record<string, { rarity: ItemSpawnRarity; dropWeight: number }>,
);
