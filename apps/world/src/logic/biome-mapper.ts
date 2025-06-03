import { TerrainData } from './noise-generator';

export interface BiomeRule {
  name: string;
  heightRange: [number, number];     // [min, max] 0-1
  temperatureRange: [number, number]; // [min, max] 0-1
  moistureRange: [number, number];   // [min, max] 0-1
  priority: number;                  // Higher priority wins ties
  description: string;
}

// Comprehensive biome definitions based on real-world climate zones
export const BIOME_RULES: BiomeRule[] = [
  // Water bodies (low elevation)
  {
    name: 'ocean',
    heightRange: [0.0, 0.25],
    temperatureRange: [0.0, 1.0],
    moistureRange: [0.0, 1.0],
    priority: 10,
    description: 'Deep ocean waters.'
  },
  {
    name: 'lake',
    heightRange: [0.25, 0.35],
    temperatureRange: [0.0, 1.0],
    moistureRange: [0.7, 1.0],
    priority: 9,
    description: 'A freshwater lake.'
  },

  // Beach/coastal (low elevation, variable conditions)
  {
    name: 'beach',
    heightRange: [0.3, 0.4],
    temperatureRange: [0.4, 0.9],
    moistureRange: [0.0, 0.6],
    priority: 8,
    description: 'Sandy beach along the coastline.'
  },

  // Cold biomes (low temperature)
  {
    name: 'tundra',
    heightRange: [0.3, 0.7],
    temperatureRange: [0.0, 0.2],
    moistureRange: [0.0, 0.5],
    priority: 7,
    description: 'Frozen tundra with sparse vegetation.'
  },
  {
    name: 'taiga',
    heightRange: [0.3, 0.7],
    temperatureRange: [0.1, 0.3],
    moistureRange: [0.4, 0.8],
    priority: 7,
    description: 'Coniferous forest of the north.'
  },

  // Mountainous (high elevation)
  {
    name: 'mountains',
    heightRange: [0.8, 1.0],
    temperatureRange: [0.0, 0.4],
    moistureRange: [0.0, 1.0],
    priority: 9,
    description: 'Towering mountains with rocky peaks.'
  },
  {
    name: 'hills',
    heightRange: [0.6, 0.8],
    temperatureRange: [0.2, 0.7],
    moistureRange: [0.0, 1.0],
    priority: 6,
    description: 'Rolling hills and gentle slopes.'
  },

  // Hot and dry (high temperature, low moisture)
  {
    name: 'desert',
    heightRange: [0.3, 0.7],
    temperatureRange: [0.7, 1.0],
    moistureRange: [0.0, 0.3],
    priority: 7,
    description: 'A vast, arid desert.'
  },
  {
    name: 'savanna',
    heightRange: [0.3, 0.6],
    temperatureRange: [0.6, 0.9],
    moistureRange: [0.2, 0.5],
    priority: 6,
    description: 'Open grassland with scattered trees.'
  },

  // Temperate (moderate temperature and moisture)
  {
    name: 'plains',
    heightRange: [0.35, 0.6],
    temperatureRange: [0.4, 0.7],
    moistureRange: [0.3, 0.6],
    priority: 5,
    description: 'Open plains with tall grass.'
  },
  {
    name: 'forest',
    heightRange: [0.35, 0.7],
    temperatureRange: [0.3, 0.7],
    moistureRange: [0.5, 0.8],
    priority: 6,
    description: 'A dense forest with tall trees.'
  },

  // Hot and wet (high temperature, high moisture)
  {
    name: 'jungle',
    heightRange: [0.3, 0.6],
    temperatureRange: [0.7, 1.0],
    moistureRange: [0.7, 1.0],
    priority: 7,
    description: 'Dense tropical jungle with exotic wildlife.'
  },
  {
    name: 'rainforest',
    heightRange: [0.35, 0.65],
    temperatureRange: [0.6, 0.9],
    moistureRange: [0.8, 1.0],
    priority: 7,
    description: 'Lush rainforest teeming with life.'
  },

  // Wetlands (high moisture, various conditions)
  {
    name: 'swamp',
    heightRange: [0.25, 0.45],
    temperatureRange: [0.4, 0.8],
    moistureRange: [0.8, 1.0],
    priority: 7,
    description: 'Murky swampland with twisted trees.'
  },

  // Human settlements (can appear in various conditions but prefer temperate)
  {
    name: 'village',
    heightRange: [0.35, 0.65],
    temperatureRange: [0.3, 0.8],
    moistureRange: [0.3, 0.7],
    priority: 3, // Lower priority so natural biomes are preferred
    description: 'A small village with a few houses.'
  },
  {
    name: 'city',
    heightRange: [0.35, 0.65],
    temperatureRange: [0.3, 0.8],
    moistureRange: [0.3, 0.7],
    priority: 2, // Even lower priority
    description: 'A bustling city full of life.'
  }
];

export class BiomeMapper {
  /**
   * Determine the best biome for given terrain data
   */
  static getBiome(terrain: TerrainData): string {
    let bestMatch: BiomeRule | null = null;
    let bestScore = -1;

    for (const rule of BIOME_RULES) {
      const score = this.calculateBiomeScore(terrain, rule);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = rule;
      }
    }

    return bestMatch?.name || 'plains';
  }

  /**
   * Calculate how well terrain data matches a biome rule
   */
  private static calculateBiomeScore(terrain: TerrainData, rule: BiomeRule): number {
    // Check if terrain falls within the ranges
    const heightMatch = terrain.height >= rule.heightRange[0] && terrain.height <= rule.heightRange[1];
    const tempMatch = terrain.temperature >= rule.temperatureRange[0] && terrain.temperature <= rule.temperatureRange[1];
    const moistureMatch = terrain.moisture >= rule.moistureRange[0] && terrain.moisture <= rule.moistureRange[1];

    if (!heightMatch || !tempMatch || !moistureMatch) {
      return -1; // No match
    }

    // Calculate how close to the center of each range we are
    const heightCenter = (rule.heightRange[0] + rule.heightRange[1]) / 2;
    const tempCenter = (rule.temperatureRange[0] + rule.temperatureRange[1]) / 2;
    const moistureCenter = (rule.moistureRange[0] + rule.moistureRange[1]) / 2;

    const heightDistance = Math.abs(terrain.height - heightCenter);
    const tempDistance = Math.abs(terrain.temperature - tempCenter);
    const moistureDistance = Math.abs(terrain.moisture - moistureCenter);

    // Higher score for being closer to the center, plus rule priority
    const centerScore = 1 - (heightDistance + tempDistance + moistureDistance) / 3;
    return centerScore * rule.priority;
  }

  /**
   * Get biome mix for a location based on surrounding terrain
   */
  static getBiomeMix(terrainGrid: TerrainData[][], centerX: number, centerY: number): Record<string, number> {
    const biomeCounts: Record<string, number> = {};
    let totalSamples = 0;

    // Sample a 3x3 area around the center point
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = centerX + dx;
        const y = centerY + dy;
        
        if (x >= 0 && x < terrainGrid.length && y >= 0 && y < terrainGrid[0].length) {
          const biome = this.getBiome(terrainGrid[x][y]);
          biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;
          totalSamples++;
        }
      }
    }

    // Convert counts to percentages
    const biomeMix: Record<string, number> = {};
    for (const [biome, count] of Object.entries(biomeCounts)) {
      biomeMix[biome] = Math.round((count / totalSamples) * 100) / 100;
    }

    return biomeMix;
  }

  /**
   * Check if a biome should have special placement rules (like cities/villages)
   */
  static isSettlement(biomeName: string): boolean {
    return biomeName === 'city' || biomeName === 'village';
  }

  /**
   * Get all available biome names
   */
  static getAllBiomes(): string[] {
    return BIOME_RULES.map(rule => rule.name);
  }
}
