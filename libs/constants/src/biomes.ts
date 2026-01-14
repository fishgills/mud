/**
 * Biome definitions - Single source of truth for all biome data
 *
 * This module provides:
 * - BiomeId enum for type-safe biome references
 * - BiomeInfo metadata (name, description, color, ascii)
 * - Helper functions for biome lookups
 */

/**
 * Biome IDs - The authoritative source for biome identifiers.
 * Kept for legacy content and future world features.
 */
export enum BiomeId {
  OCEAN = 1,
  SHALLOW_OCEAN = 2,
  BEACH = 3,
  DESERT = 4,
  GRASSLAND = 5,
  FOREST = 6,
  JUNGLE = 7,
  SWAMP = 8,
  LAKE = 9,
  RIVER = 10,
  TUNDRA = 11,
  TAIGA = 12,
  MOUNTAIN = 13,
  SNOWY_MOUNTAIN = 14,
  HILLS = 15,
  SAVANNA = 16,
  ALPINE = 17,
  VOLCANIC = 18,
}

/**
 * Biome name type - derived from enum for type safety
 */
export type BiomeName =
  | 'Ocean'
  | 'Shallow Ocean'
  | 'Beach'
  | 'Desert'
  | 'Grassland'
  | 'Forest'
  | 'Jungle'
  | 'Swamp'
  | 'Lake'
  | 'River'
  | 'Tundra'
  | 'Taiga'
  | 'Mountain'
  | 'Snowy Mountain'
  | 'Hills'
  | 'Savanna'
  | 'Alpine'
  | 'Volcanic';

/**
 * Biome metadata for display and rendering
 */
export interface BiomeInfo {
  id: BiomeId;
  name: BiomeName;
  description: string;
  color: string; // Hex color for rendering
  ascii: string; // Single character for ASCII rendering
}

/**
 * Complete biome definitions indexed by BiomeId
 */
export const BIOMES: Record<BiomeId, BiomeInfo> = {
  [BiomeId.OCEAN]: {
    id: BiomeId.OCEAN,
    name: 'Ocean',
    description: 'Deep blue waters',
    color: '#4c5aa4',
    ascii: '~',
  },
  [BiomeId.SHALLOW_OCEAN]: {
    id: BiomeId.SHALLOW_OCEAN,
    name: 'Shallow Ocean',
    description: 'Light blue coastal waters',
    color: '#4f64c9',
    ascii: '≈',
  },
  [BiomeId.BEACH]: {
    id: BiomeId.BEACH,
    name: 'Beach',
    description: 'Sandy coastline',
    color: '#f8d796',
    ascii: '.',
  },
  [BiomeId.DESERT]: {
    id: BiomeId.DESERT,
    name: 'Desert',
    description: 'Hot, dry sands',
    color: '#f7dc6f',
    ascii: 'd',
  },
  [BiomeId.GRASSLAND]: {
    id: BiomeId.GRASSLAND,
    name: 'Grassland',
    description: 'Rolling green plains',
    color: '#61a84d',
    ascii: 'g',
  },
  [BiomeId.FOREST]: {
    id: BiomeId.FOREST,
    name: 'Forest',
    description: 'Dense woodland',
    color: '#3b8632',
    ascii: 'T',
  },
  [BiomeId.JUNGLE]: {
    id: BiomeId.JUNGLE,
    name: 'Jungle',
    description: 'Tropical rainforest',
    color: '#1e8449',
    ascii: 'J',
  },
  [BiomeId.SWAMP]: {
    id: BiomeId.SWAMP,
    name: 'Swamp',
    description: 'Murky wetlands',
    color: '#52c41a',
    ascii: 'S',
  },
  [BiomeId.LAKE]: {
    id: BiomeId.LAKE,
    name: 'Lake',
    description: 'Fresh water lake',
    color: '#3498db',
    ascii: 'L',
  },
  [BiomeId.RIVER]: {
    id: BiomeId.RIVER,
    name: 'River',
    description: 'Flowing water',
    color: '#5dade2',
    ascii: 'r',
  },
  [BiomeId.TUNDRA]: {
    id: BiomeId.TUNDRA,
    name: 'Tundra',
    description: 'Cold, barren land',
    color: '#a8a8fd',
    ascii: 't',
  },
  [BiomeId.TAIGA]: {
    id: BiomeId.TAIGA,
    name: 'Taiga',
    description: 'Northern coniferous forest',
    color: '#196f3d',
    ascii: 'P',
  },
  [BiomeId.MOUNTAIN]: {
    id: BiomeId.MOUNTAIN,
    name: 'Mountain',
    description: 'Rocky peaks',
    color: '#533e1a',
    ascii: '^',
  },
  [BiomeId.SNOWY_MOUNTAIN]: {
    id: BiomeId.SNOWY_MOUNTAIN,
    name: 'Snowy Mountain',
    description: 'Snow-capped peaks',
    color: '#e2e1de',
    ascii: 'A',
  },
  [BiomeId.HILLS]: {
    id: BiomeId.HILLS,
    name: 'Hills',
    description: 'Rolling hills',
    color: '#a9dfbf',
    ascii: 'h',
  },
  [BiomeId.SAVANNA]: {
    id: BiomeId.SAVANNA,
    name: 'Savanna',
    description: 'Tropical grassland',
    color: '#98cb2a',
    ascii: 's',
  },
  [BiomeId.ALPINE]: {
    id: BiomeId.ALPINE,
    name: 'Alpine',
    description: 'High mountain meadows',
    color: '#abebc6',
    ascii: 'a',
  },
  [BiomeId.VOLCANIC]: {
    id: BiomeId.VOLCANIC,
    name: 'Volcanic',
    description: 'Active volcanic region',
    color: '#e74c3c',
    ascii: 'V',
  },
};

/**
 * List of all biome IDs
 */
export const ALL_BIOME_IDS = Object.values(BiomeId).filter(
  (v): v is BiomeId => typeof v === 'number',
);

/**
 * Water biome IDs - tiles players/monsters cannot traverse
 */
export const WATER_BIOME_IDS: readonly BiomeId[] = [
  BiomeId.OCEAN,
  BiomeId.SHALLOW_OCEAN,
  BiomeId.LAKE,
  BiomeId.RIVER,
] as const;

/**
 * Check if a biome is a water biome (impassable)
 */
export function isWaterBiome(biomeId: BiomeId): boolean;
export function isWaterBiome(biomeName: string | null | undefined): boolean;
export function isWaterBiome(
  biomeIdOrName: BiomeId | string | null | undefined,
): boolean {
  if (biomeIdOrName === null || biomeIdOrName === undefined) {
    return false;
  }

  if (typeof biomeIdOrName === 'number') {
    return WATER_BIOME_IDS.includes(biomeIdOrName);
  }

  // String-based lookup for backwards compatibility
  const normalized = biomeIdOrName.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('ocean') ||
    normalized.includes('lake') ||
    normalized.includes('river') ||
    normalized.includes('water')
  );
}

/**
 * Get biome info by ID
 * Accepts BiomeId enum or plain number for backwards compatibility
 */
export function getBiomeById(id: BiomeId | number): BiomeInfo {
  return BIOMES[id as BiomeId];
}

/**
 * Get biome info by name (case-insensitive)
 */
export function getBiomeByName(name: string): BiomeInfo | undefined {
  const normalized = name.trim().toLowerCase();
  return Object.values(BIOMES).find((b) => b.name.toLowerCase() === normalized);
}

/**
 * Get BiomeId from name (case-insensitive)
 * Returns undefined if not found
 */
export function getBiomeIdByName(name: string): BiomeId | undefined {
  return getBiomeByName(name)?.id;
}

/**
 * Lookup table from lowercase name to BiomeId for fast lookups
 */
export const BIOME_NAME_TO_ID: Record<string, BiomeId> = Object.values(
  BIOMES,
).reduce(
  (acc, biome) => {
    acc[biome.name.toLowerCase()] = biome.id;
    return acc;
  },
  {} as Record<string, BiomeId>,
);

/**
 * Legacy format for backwards compatibility
 * Maps uppercase key to BiomeInfo
 */
export const BIOMES_BY_KEY: Record<string, BiomeInfo> = {
  OCEAN: BIOMES[BiomeId.OCEAN],
  SHALLOW_OCEAN: BIOMES[BiomeId.SHALLOW_OCEAN],
  BEACH: BIOMES[BiomeId.BEACH],
  DESERT: BIOMES[BiomeId.DESERT],
  GRASSLAND: BIOMES[BiomeId.GRASSLAND],
  FOREST: BIOMES[BiomeId.FOREST],
  JUNGLE: BIOMES[BiomeId.JUNGLE],
  SWAMP: BIOMES[BiomeId.SWAMP],
  LAKE: BIOMES[BiomeId.LAKE],
  RIVER: BIOMES[BiomeId.RIVER],
  TUNDRA: BIOMES[BiomeId.TUNDRA],
  TAIGA: BIOMES[BiomeId.TAIGA],
  MOUNTAIN: BIOMES[BiomeId.MOUNTAIN],
  SNOWY_MOUNTAIN: BIOMES[BiomeId.SNOWY_MOUNTAIN],
  HILLS: BIOMES[BiomeId.HILLS],
  SAVANNA: BIOMES[BiomeId.SAVANNA],
  ALPINE: BIOMES[BiomeId.ALPINE],
  VOLCANIC: BIOMES[BiomeId.VOLCANIC],
};
