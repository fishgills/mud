export interface BiomeInfo {
  id: number;
  name: string;
  description: string;
  color: string; // For rendering
  ascii: string; // Single character for ASCII rendering
}

export interface TileData {
  x: number;
  y: number;
  height: number;
  temperature: number;
  moisture: number;
  biome: BiomeInfo;
}

// Biome definitions
export const BIOMES: Record<string, BiomeInfo> = {
  OCEAN: {
    id: 1,
    name: 'Ocean',
    description: 'Deep blue waters',
    color: '#1e3a5f',
    ascii: '~',
  },
  SHALLOW_OCEAN: {
    id: 2,
    name: 'Shallow Ocean',
    description: 'Light blue coastal waters',
    color: '#2e5f8f',
    ascii: '≈',
  },
  BEACH: {
    id: 3,
    name: 'Beach',
    description: 'Sandy coastline',
    color: '#f4d03f',
    ascii: '.',
  },
  DESERT: {
    id: 4,
    name: 'Desert',
    description: 'Hot, dry sands',
    color: '#f7dc6f',
    ascii: 'd',
  },
  GRASSLAND: {
    id: 5,
    name: 'Grassland',
    description: 'Rolling green plains',
    color: '#58d68d',
    ascii: 'g',
  },
  FOREST: {
    id: 6,
    name: 'Forest',
    description: 'Dense woodland',
    color: '#27ae60',
    ascii: 'T',
  },
  JUNGLE: {
    id: 7,
    name: 'Jungle',
    description: 'Tropical rainforest',
    color: '#1e8449',
    ascii: 'J',
  },
  SWAMP: {
    id: 8,
    name: 'Swamp',
    description: 'Murky wetlands',
    color: '#52c41a',
    ascii: 'S',
  },
  LAKE: {
    id: 9,
    name: 'Lake',
    description: 'Fresh water lake',
    color: '#3498db',
    ascii: 'L',
  },
  RIVER: {
    id: 10,
    name: 'River',
    description: 'Flowing water',
    color: '#5dade2',
    ascii: 'r',
  },
  TUNDRA: {
    id: 11,
    name: 'Tundra',
    description: 'Cold, barren land',
    color: '#d5dbdb',
    ascii: 't',
  },
  TAIGA: {
    id: 12,
    name: 'Taiga',
    description: 'Northern coniferous forest',
    color: '#196f3d',
    ascii: 'P',
  },
  MOUNTAIN: {
    id: 13,
    name: 'Mountain',
    description: 'Rocky peaks',
    color: '#85929e',
    ascii: '^',
  },
  SNOWY_MOUNTAIN: {
    id: 14,
    name: 'Snowy Mountain',
    description: 'Snow-capped peaks',
    color: '#f8f9fa',
    ascii: 'A',
  },
  HILLS: {
    id: 15,
    name: 'Hills',
    description: 'Rolling hills',
    color: '#a9dfbf',
    ascii: 'h',
  },
  SAVANNA: {
    id: 16,
    name: 'Savanna',
    description: 'Tropical grassland',
    color: '#f1c40f',
    ascii: 's',
  },
  ALPINE: {
    id: 17,
    name: 'Alpine',
    description: 'High mountain meadows',
    color: '#abebc6',
    ascii: 'a',
  },
  VOLCANIC: {
    id: 18,
    name: 'Volcanic',
    description: 'Active volcanic region',
    color: '#e74c3c',
    ascii: 'V',
  },
};

export class BiomeGenerator {
  static determineBiome(
    height: number,
    temperature: number,
    moisture: number
  ): BiomeInfo {
    // Water biomes (low height)
    if (height < 0.2) {
      if (height < 0.1) {
        return BIOMES.OCEAN;
      } else {
        return BIOMES.SHALLOW_OCEAN;
      }
    }

    // Beach (low height, near water)
    if (height < 0.25) {
      return BIOMES.BEACH;
    }

    // Very high elevation
    if (height > 0.8) {
      if (temperature < 0.3) {
        return BIOMES.SNOWY_MOUNTAIN;
      } else if (height > 0.9 && temperature > 0.7) {
        return BIOMES.VOLCANIC;
      } else {
        return BIOMES.MOUNTAIN;
      }
    }

    // High elevation
    if (height > 0.6) {
      if (temperature > 0.6) {
        return BIOMES.HILLS;
      } else if (temperature < 0.4) {
        return BIOMES.ALPINE;
      } else {
        return BIOMES.HILLS;
      }
    }

    // Lakes and rivers (mid-elevation with high moisture)
    if (height > 0.25 && height < 0.4 && moisture > 0.8) {
      return BIOMES.LAKE;
    }

    // Cold biomes
    if (temperature < 0.3) {
      if (moisture > 0.5) {
        return BIOMES.TAIGA;
      } else {
        return BIOMES.TUNDRA;
      }
    }

    // Hot biomes
    if (temperature > 0.7) {
      if (moisture < 0.3) {
        return BIOMES.DESERT;
      } else if (moisture > 0.7) {
        return BIOMES.JUNGLE;
      } else {
        return BIOMES.SAVANNA;
      }
    }

    // Temperate biomes
    if (moisture > 0.6) {
      if (moisture > 0.8) {
        return BIOMES.SWAMP;
      } else {
        return BIOMES.FOREST;
      }
    } else if (moisture > 0.3) {
      return BIOMES.GRASSLAND;
    } else {
      return BIOMES.DESERT;
    }
  }

  static generateTileDescription(
    biome: BiomeInfo,
    height: number,
    temperature: number,
    moisture: number
  ): string {
    const heightDesc =
      height > 0.8
        ? 'elevated'
        : height > 0.6
        ? 'hilly'
        : height > 0.4
        ? 'rolling'
        : 'flat';
    const tempDesc =
      temperature > 0.7 ? 'hot' : temperature > 0.4 ? 'temperate' : 'cold';
    const moistDesc =
      moisture > 0.7 ? 'humid' : moisture > 0.4 ? 'moderate' : 'dry';

    return `${biome.description} in a ${heightDesc}, ${tempDesc}, ${moistDesc} region.`;
  }
}
