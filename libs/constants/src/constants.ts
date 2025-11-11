import { PlayerSlot } from '@mud/database';

export const WORLD_CHUNK_SIZE = 50;

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

export type ItemSpawnRarity =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Epic'
  | 'Legendary';

export interface ItemTemplateSeed {
  name: string;
  type: string;
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
    type: 'weapon',
    description: 'A pitted dagger favored by desperate highwaymen.',
    value: 4,
    attack: 2,
    rarity: 'Common',
    dropWeight: 11,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Shortsword',
    type: 'weapon',
    description: 'A basic shortsword. Reliable and cheap.',
    value: 10,
    attack: 3,
    rarity: 'Common',
    dropWeight: 9,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Traveler\'s Cloak',
    type: 'armor',
    description: 'A weathered cloak that offers modest protection from the elements.',
    value: 8,
    defense: 1,
    rarity: 'Common',
    dropWeight: 10,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Leather Boots',
    type: 'armor',
    description: 'Soft boots that keep the dust off your feet.',
    value: 6,
    defense: 1,
    rarity: 'Common',
    dropWeight: 10,
    slot: PlayerSlot.legs,
  },
  {
    name: 'Oak Staff',
    type: 'weapon',
    description: 'A sturdy staff engraved with simple runes.',
    value: 12,
    attack: 2,
    healthBonus: 5,
    rarity: 'Common',
    dropWeight: 8,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Minor Healing Draught',
    type: 'consumable',
    description: 'Restores a small amount of health when consumed.',
    value: 5,
    healthBonus: 20,
    rarity: 'Common',
    dropWeight: 10,
  },
  {
    name: 'Copper Coin',
    type: 'currency',
    description: 'A small copper coin. Used as currency.',
    value: 1,
    rarity: 'Common',
    dropWeight: 12,
  },
  {
    name: 'Tempered Longsword',
    type: 'weapon',
    description: 'A well-balanced blade favored by veteran guards.',
    value: 35,
    attack: 5,
    rarity: 'Uncommon',
    dropWeight: 6,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Hunter\'s Recurve Bow',
    type: 'weapon',
    description: 'Curved limbs deliver a powerful, silent shot.',
    value: 32,
    attack: 4,
    rarity: 'Uncommon',
    dropWeight: 5,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Reinforced Leather',
    type: 'armor',
    description: 'Layered hide stitched over chain links.',
    value: 30,
    defense: 4,
    rarity: 'Uncommon',
    dropWeight: 5,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Ember Wand',
    type: 'weapon',
    description: 'Warm to the touch and eager to spit sparks.',
    value: 34,
    attack: 3,
    healthBonus: 5,
    rarity: 'Uncommon',
    dropWeight: 4,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Greater Healing Potion',
    type: 'consumable',
    description: 'A concentrated tonic that mends deep wounds.',
    value: 25,
    healthBonus: 45,
    rarity: 'Uncommon',
    dropWeight: 6,
  },
  {
    name: 'Stormcaller\'s Blade',
    type: 'weapon',
    description: 'Crackles with barely contained lightning.',
    value: 85,
    attack: 7,
    rarity: 'Rare',
    dropWeight: 2.5,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Frostguard Plate',
    type: 'armor',
    description: 'Heavy plate lined with glimmering frostglass.',
    value: 90,
    defense: 6,
    rarity: 'Rare',
    dropWeight: 2.3,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Shadowstep Boots',
    type: 'armor',
    description: 'Silent leather that seems to blur at the edges.',
    value: 70,
    defense: 3,
    healthBonus: 10,
    rarity: 'Rare',
    dropWeight: 2.8,
    slot: PlayerSlot.legs,
  },
  {
    name: 'Phoenix Plume',
    type: 'consumable',
    description: 'A blazing feather that reignites fallen courage.',
    value: 60,
    healthBonus: 80,
    rarity: 'Rare',
    dropWeight: 2,
  },
  {
    name: 'Dragonsoul Greatsword',
    type: 'weapon',
    description: 'Forged from the bones of an ancient wyrm.',
    value: 150,
    attack: 12,
    rarity: 'Epic',
    dropWeight: 1.2,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Umbral Shroud',
    type: 'armor',
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
    type: 'weapon',
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
    type: 'weapon',
    description: 'Said to have split a continent in mythic wars.',
    value: 250,
    attack: 16,
    rarity: 'Legendary',
    dropWeight: 0.45,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Crown of the First Flame',
    type: 'armor',
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
> = ITEM_TEMPLATES.reduce((acc, template) => {
  acc[template.name] = {
    rarity: template.rarity,
    dropWeight: template.dropWeight,
  };
  return acc;
}, {} as Record<string, { rarity: ItemSpawnRarity; dropWeight: number }>);
