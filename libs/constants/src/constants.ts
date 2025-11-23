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

export interface WeightedItemTemplate {
  template: ItemTemplateSeed;
  weight: number;
}

export interface WeightedQuality {
  quality: ItemQualityType;
  weight: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function computeTemplateWeights(level: number): WeightedItemTemplate[] {
  const clampedLevel = Math.max(1, Math.min(level, MAX_PLAYER_SCALE));
  const levelBias = clamp((clampedLevel - 1) * 0.02, 0, 0.6);
  const expected = expectedRankForLevel(clampedLevel);
  return ITEM_TEMPLATES.map((template) => {
    const rarityRank = ITEM_QUALITY_PRIORITY[template.rarity] ?? 0;
    const r = template.rank ?? 1;
    const rankDistance = Math.abs(r - expected);
    const rankPenalty = 1 + rankDistance * 0.9;
    const levelBoost = 1 + levelBias * (r / MAX_ITEM_RANK);
    const rarityPenalty = 1 + rarityRank * 0.8;
    const weight = Math.max(
      0.02,
      (template.dropWeight / (rarityPenalty * rankPenalty)) * levelBoost,
    );
    return { template, weight };
  });
}

export function pickTemplateForLevel(
  level: number,
  rng: () => number = Math.random,
): ItemTemplateSeed {
  const weighted = computeTemplateWeights(level);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = rng() * total;
  let cumulative = 0;
  for (const entry of weighted) {
    cumulative += entry.weight;
    if (roll <= cumulative) {
      return entry.template;
    }
  }
  return weighted[weighted.length - 1]?.template ?? ITEM_TEMPLATES[0];
}

export function computeQualityWeights(level: number): WeightedQuality[] {
  const bias = clamp((level - 1) * 0.01, 0, 0.2);
  return ITEM_QUALITY_ORDER.map((quality) => {
    const rank = ITEM_QUALITY_PRIORITY[quality] ?? 0;
    const rarityPenalty = 1 + rank * 0.75;
    const bonus = 1 + bias * rank * 1.45;
    return {
      quality,
      weight: Math.max(0.01, (1 / rarityPenalty) * bonus),
    };
  });
}

export function rollQualityForLevel(
  level: number,
  rng: () => number = Math.random,
): ItemQualityType {
  const weights = computeQualityWeights(level);
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of weights) {
    if (roll <= entry.weight) {
      return entry.quality;
    }
    roll -= entry.weight;
  }
  return weights[weights.length - 1]?.quality ?? ItemQuality.Common;
}

export interface ItemTemplateSeed {
  name: string;
  type: ItemType;
  description: string;
  value: number;
  damageRoll?: string;
  defense?: number;
  slot?: PlayerSlot;
  rarity: ItemSpawnRarity;
  dropWeight: number;
  rank?: number; // 1..MAX_ITEM_RANK
}

export const MAX_ITEM_RANK = 10;
export const MAX_PLAYER_SCALE = 20;

export function expectedRankForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_PLAYER_SCALE, Math.floor(level)));
  // Map 1..MAX_PLAYER_SCALE -> 1..MAX_ITEM_RANK
  const rank = Math.ceil((clamped / MAX_PLAYER_SCALE) * MAX_ITEM_RANK);
  return Math.max(1, Math.min(MAX_ITEM_RANK, rank));
}

export function pickTemplatesForLevel(
  level: number,
  count: number,
  rng: () => number = Math.random,
): ItemTemplateSeed[] {
  const weighted = computeTemplateWeights(level);
  // Sample unique templates without replacement based on weights
  const picks: ItemTemplateSeed[] = [];
  const entries = [...weighted];
  const totalOriginal = entries.reduce((s, e) => s + e.weight, 0);
  for (let i = 0; i < Math.max(1, count) && entries.length > 0; i++) {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < entries.length; idx++) {
      roll -= entries[idx].weight;
      if (roll <= 0) break;
    }
    if (idx >= entries.length) idx = entries.length - 1;
    picks.push(entries[idx].template);
    entries.splice(idx, 1);
  }
  return picks;
}

export const ITEM_TEMPLATES: ItemTemplateSeed[] = [
  {
    name: 'Splintered Club',
    type: ItemType.WEAPON,
    description: 'A broken length of wood barely fit for a fight.',
    value: 1,
    damageRoll: '1d6',
    rarity: 'Trash',
    rank: 1,
    dropWeight: 14,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Threadbare Tunic',
    type: ItemType.ARMOR,
    description: 'Patched repeatedly and offering almost no protection.',
    value: 2,
    defense: 0,
    rarity: 'Poor',
    rank: 1,
    dropWeight: 12,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Rusty Dagger',
    type: ItemType.WEAPON,
    description: 'A pitted dagger favored by desperate highwaymen.',
    value: 4,
    damageRoll: '1d6',
    rarity: 'Common',
    rank: 2,
    dropWeight: 11,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Shortsword',
    type: ItemType.WEAPON,
    description: 'A basic shortsword. Reliable and cheap.',
    value: 10,
    damageRoll: '1d6',
    rarity: 'Common',
    rank: 3,
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
    rank: 2,
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
    rank: 2,
    dropWeight: 10,
    slot: PlayerSlot.legs,
  },
  {
    name: 'Oak Staff',
    type: ItemType.WEAPON,
    description: 'A sturdy staff engraved with simple runes.',
    value: 12,
    damageRoll: '1d6',
    rarity: 'Common',
    rank: 3,
    dropWeight: 8,
    slot: PlayerSlot.weapon,
  },

  {
    name: 'Tempered Longsword',
    type: ItemType.WEAPON,
    description: 'A well-balanced blade favored by veteran guards.',
    value: 35,
    damageRoll: '1d8',
    rarity: 'Uncommon',
    rank: 4,
    dropWeight: 6,
    slot: PlayerSlot.weapon,
  },
  {
    name: "Hunter's Recurve Bow",
    type: ItemType.WEAPON,
    description: 'Curved limbs deliver a powerful, silent shot.',
    value: 32,
    damageRoll: '1d8',
    rarity: 'Uncommon',
    rank: 4,
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
    rank: 4,
    dropWeight: 5,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Ember Wand',
    type: ItemType.WEAPON,
    description: 'Warm to the touch and eager to spit sparks.',
    value: 34,
    damageRoll: '1d6',
    rarity: 'Uncommon',
    rank: 4,
    dropWeight: 4,
    slot: PlayerSlot.weapon,
  },

  {
    name: 'Skyglass Rapier',
    type: ItemType.WEAPON,
    description: 'A featherlight blade that slices the air itself.',
    value: 115,
    damageRoll: '1d8',
    rarity: 'Fine',
    rank: 5,
    dropWeight: 3.5,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Runed Brigandine',
    type: ItemType.ARMOR,
    description: 'Inset plates hum softly with reinforcing sigils.',
    value: 95,
    defense: 5,
    rarity: 'Superior',
    rank: 5,
    dropWeight: 2.8,
    slot: PlayerSlot.chest,
  },

  {
    name: "Stormcaller's Blade",
    type: ItemType.WEAPON,
    description: 'Crackles with barely contained lightning.',
    value: 85,
    damageRoll: '1d10',
    rarity: 'Rare',
    rank: 6,
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
    rank: 6,
    dropWeight: 2.3,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Shadowstep Boots',
    type: ItemType.ARMOR,
    description: 'Silent leather that seems to blur at the edges.',
    value: 70,
    defense: 3,
    rarity: 'Rare',
    rank: 6,
    dropWeight: 2.8,
    slot: PlayerSlot.legs,
  },

  {
    name: 'Dragonsoul Greatsword',
    type: ItemType.WEAPON,
    description: 'Forged from the bones of an ancient wyrm.',
    value: 150,
    damageRoll: '2d6',
    rarity: 'Epic',
    rank: 8,
    dropWeight: 1.2,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Umbral Shroud',
    type: ItemType.ARMOR,
    description: 'A mantle that drinks in the light around it.',
    value: 140,
    defense: 5,
    rarity: 'Epic',
    rank: 7,
    dropWeight: 1,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Celestial Scepter',
    type: ItemType.WEAPON,
    description: 'Stars wink within the crystal atop this staff.',
    value: 145,
    damageRoll: '1d8',
    rarity: 'Epic',
    rank: 8,
    dropWeight: 0.9,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Worldrender Halberd',
    type: ItemType.WEAPON,
    description: 'Said to have split a continent in mythic wars.',
    value: 250,
    damageRoll: '1d12',
    rarity: 'Legendary',
    rank: 9,
    dropWeight: 0.45,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Crown of the First Flame',
    type: ItemType.ARMOR,
    description: 'An ornate circlet that glows with eternal fire.',
    value: 220,
    defense: 4,
    rarity: 'Legendary',
    rank: 9,
    dropWeight: 0.4,
    slot: PlayerSlot.head,
  },
  {
    name: 'Dragonvein Spellblade',
    type: ItemType.WEAPON,
    description: 'A blade forged to channel ancestral draconic power.',
    value: 320,
    damageRoll: '2d8',
    rarity: 'Mythic',
    rank: 10,
    dropWeight: 0.28,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Relic of the First Dawn',
    type: ItemType.WEAPON,
    description: 'Radiates ancient sunlight that burns through armor.',
    value: 380,
    damageRoll: '2d6',
    rarity: 'Artifact',
    rank: 10,
    dropWeight: 0.2,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Aegis of Ascension',
    type: ItemType.ARMOR,
    description: 'A towering shield that shifts to intercept any blow.',
    value: 440,
    defense: 10,
    rarity: 'Ascended',
    rank: 10,
    dropWeight: 0.12,
    slot: PlayerSlot.arms,
  },
  {
    name: 'Veilpiercer Lance',
    type: ItemType.WEAPON,
    description: 'Tuned to skewer foes across planes of existence.',
    value: 520,
    damageRoll: '2d10',
    rarity: 'Transcendent',
    rank: 10,
    dropWeight: 0.08,
    slot: PlayerSlot.weapon,
  },
  {
    name: 'Primal Heartguard',
    type: ItemType.ARMOR,
    description: 'Beats in time with the world, strengthening its bearer.',
    value: 610,
    defense: 12,
    rarity: 'Primal',
    rank: 10,
    dropWeight: 0.05,
    slot: PlayerSlot.chest,
  },
  {
    name: 'Divine Chorus Vestments',
    type: ItemType.ARMOR,
    description: 'Cloth that sings softly, warding danger away.',
    value: 720,
    defense: 9,
    rarity: 'Divine',
    rank: 10,
    dropWeight: 0.03,
    slot: PlayerSlot.chest,
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

// Ensure backward compat: drop `rank` when creating database entries
export function stripTemplateForDb(
  template: ItemTemplateSeed,
): ItemTemplateSeed {
  return template;
}
