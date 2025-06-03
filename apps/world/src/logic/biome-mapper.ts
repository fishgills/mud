import { TerrainData } from './noise-generator';
import { BiomeRegistry } from './biome-definitions';

interface BiomeRule {
  name: string;
  priority: number;
  heightRange: [number, number];
  temperatureRange: [number, number];
  moistureRange: [number, number];
}

export class BiomeMapper {
  /**
   * Determine the best biome for given terrain data
   */
  static getBiome(terrain: TerrainData): string {
    const biomeRules = BiomeRegistry.getBiomeRules();
    let bestMatch: BiomeRule | null = null;
    let bestScore = -1;

    for (const rule of biomeRules) {
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
    return BiomeRegistry.isSettlement(biomeName);
  }

  /**
   * Get all available biome names
   */
  static getAllBiomes(): string[] {
    return BiomeRegistry.getAllNames();
  }
}
