import seedrandom from 'seedrandom';
import { BIOMES } from '../constants';
import {
  BiomeInfo,
  SettlementFootprint,
  SettlementWithFootprint,
  SettlementTileInfo,
} from '../world/types';
import {
  SETTLEMENT_PREFIXES,
  SETTLEMENT_ROOTS,
  SETTLEMENT_SUFFIXES,
} from './settlement-naming';
import { Settlement } from '@mud/database';
export class SettlementGenerator {
  private seed: number;

  /**
   * Creates an instance of SettlementGenerator.
   *
   * @param seed - A seed value to initialize the random number generator.
   * This seed ensures that the settlement generation is deterministic and reproducible.
   */
  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Determines whether a settlement should be generated at the given coordinates and biome.
   *
   * @param x - The x-coordinate of the location.
   * @param y - The y-coordinate of the location.
   * @param biome - The biome information at the location.
   * @returns True if a settlement should be generated, false otherwise.
   */
  shouldGenerateSettlement(x: number, y: number, biome: BiomeInfo): boolean {
    // Create a deterministic random value based on coordinates and seed
    const coordSeed = x * 1000 + y + this.seed;
    const coordRng = seedrandom(coordSeed.toString());
    const baseChance = coordRng();

    // Different biomes have different settlement probabilities
    // Greatly reduced settlement spawn rates
    const biomeModifiers: Record<string, number> = {
      [BIOMES.GRASSLAND.name]: 0.0001,
      [BIOMES.FOREST.name]: 0.00005,
      [BIOMES.HILLS.name]: 0.00005,
      [BIOMES.RIVER.name]: 0,
      [BIOMES.LAKE.name]: 0,
      [BIOMES.BEACH.name]: 0,
      [BIOMES.SAVANNA.name]: 0,
      [BIOMES.TAIGA.name]: 0,
      [BIOMES.DESERT.name]: 0.0001,
      [BIOMES.SWAMP.name]: 0,
      [BIOMES.MOUNTAIN.name]: 0,
      [BIOMES.TUNDRA.name]: 0,
      [BIOMES.OCEAN.name]: 0,
      [BIOMES.SHALLOW_OCEAN.name]: 0,
    };

    const modifier = biomeModifiers[biome.name] || 0.0005;
    return baseChance < modifier;
  }

  /**
   * Generates a settlement at the given coordinates and biome.
   * @param x - The x-coordinate of the location.
   * @param y - The y-coordinate of the location.
   * @param biome - The biome information at the location.
   * @returns The generated settlement information.
   */
  generateSettlement(x: number, y: number, biome: BiomeInfo): Settlement {
    // Create deterministic randomness based on coordinates
    const coordSeed = x * 1000 + y + this.seed;
    const coordRng = seedrandom(coordSeed.toString());

    const name = this.generateSettlementName(coordRng);
    const { type, size, population } = this.determineSettlementSize(
      coordRng,
      biome,
    );
    const description = this.generateSettlementDescription(
      type,
      biome,
      coordRng,
    );

    // Generate settlement footprint (not stored with the Settlement but used for generation)
    // const footprint = this.generateSettlementFootprint(x, y, size, coordRng);

    return {
      id: 0, // Will be assigned by database
      name,
      type,
      size,
      population,
      x,
      y,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Check if a given coordinate is within any settlement's footprint
   * @param x - The x-coordinate to check
   * @param y - The y-coordinate to check
   * @param settlements - Array of settlements to check against
   * @returns Settlement tile information if the coordinate is within a settlement
   */
  static getSettlementAtCoordinate(
    x: number,
    y: number,
    settlements: SettlementWithFootprint[],
  ): SettlementTileInfo {
    for (const settlement of settlements) {
      if (settlement.footprint) {
        const tile = settlement.footprint.tiles.find(
          (t: { x: number; y: number; intensity: number }) =>
            t.x === x && t.y === y,
        );
        if (tile) {
          return {
            isSettlement: true,
            settlementName: settlement.name,
            settlementType: settlement.type,
            intensity: tile.intensity,
          };
        }
      } else {
        // Fallback for settlements without footprint (legacy support)
        if (settlement.x === x && settlement.y === y) {
          return {
            isSettlement: true,
            settlementName: settlement.name,
            settlementType: settlement.type,
            intensity: 1.0,
          };
        }
      }
    }

    return {
      isSettlement: false,
      intensity: 0,
    };
  }

  /**
   *
   * @param rng - A function that returns a random number between 0 and 1.
   * @returns
   */
  private generateSettlementName(rng: () => number): string {
    const usePrefix = rng() < 0.4;
    const useSuffix = rng() < 0.8;

    let name = '';

    if (usePrefix) {
      name +=
        SETTLEMENT_PREFIXES[Math.floor(rng() * SETTLEMENT_PREFIXES.length)] +
        ' ';
    }

    name += SETTLEMENT_ROOTS[Math.floor(rng() * SETTLEMENT_ROOTS.length)];

    if (useSuffix) {
      name +=
        SETTLEMENT_SUFFIXES[Math.floor(rng() * SETTLEMENT_SUFFIXES.length)];
    }

    // Capitalize first letter of each word
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private determineSettlementSize(
    rng: () => number,
    biome: BiomeInfo,
  ): {
    type: Settlement['type'];
    size: Settlement['size'];
    population: number;
  } {
    const roll = rng();

    // Biome affects settlement size probability
    const favorableBiomes = [
      BIOMES.GRASSLAND.name,
      BIOMES.RIVER.name,
      BIOMES.LAKE.name,
    ];
    const isGoodLocation = favorableBiomes.includes(biome.name);

    if (roll < (isGoodLocation ? 0.05 : 0.02)) {
      return {
        type: 'city',
        size: 'large',
        population: 5000 + Math.floor(rng() * 15000),
      };
    } else if (roll < (isGoodLocation ? 0.15 : 0.08)) {
      return {
        type: 'town',
        size: 'medium',
        population: 1000 + Math.floor(rng() * 4000),
      };
    } else if (roll < (isGoodLocation ? 0.4 : 0.25)) {
      return {
        type: 'village',
        size: 'small',
        population: 200 + Math.floor(rng() * 800),
      };
    } else if (roll < 0.7) {
      return {
        type: 'hamlet',
        size: 'tiny',
        population: 50 + Math.floor(rng() * 150),
      };
    } else {
      return {
        type: 'farm',
        size: 'tiny',
        population: 5 + Math.floor(rng() * 15),
      };
    }
  }

  private generateSettlementDescription(
    type: Settlement['type'],
    biome: BiomeInfo,
    rng: () => number,
  ): string {
    const baseDescriptions = {
      city: [
        'A bustling metropolis',
        'A grand city',
        'A thriving urban center',
      ],
      town: [
        'A prosperous town',
        'A well-established settlement',
        'A growing community',
      ],
      village: [
        'A quiet village',
        'A peaceful settlement',
        'A small community',
      ],
      hamlet: [
        'A tiny hamlet',
        'A small cluster of homes',
        'A modest settlement',
      ],
      farm: ['An isolated farmstead', 'A rural homestead', 'A working farm'],
    };

    const biomeDescriptions: Record<string, string> = {
      [BIOMES.GRASSLAND.name]: 'nestled in fertile plains',
      [BIOMES.FOREST.name]: 'surrounded by dense woodlands',
      [BIOMES.HILLS.name]: 'perched on rolling hills',
      [BIOMES.RIVER.name]: 'built along a flowing river',
      [BIOMES.LAKE.name]: 'situated by a pristine lake',
      [BIOMES.BEACH.name]: 'built along the coastline',
      [BIOMES.MOUNTAIN.name]: 'carved into the mountainside',
      [BIOMES.DESERT.name]: 'built around a desert oasis',
      [BIOMES.SAVANNA.name]: 'spread across the savanna',
      [BIOMES.TAIGA.name]: 'built in the northern wilderness',
    };

    const baseDesc =
      baseDescriptions[type as keyof typeof baseDescriptions][
        Math.floor(
          rng() *
            baseDescriptions[type as keyof typeof baseDescriptions].length,
        )
      ];
    const biomeDesc = biomeDescriptions[biome.name] || 'in a remote location';

    return `${baseDesc} ${biomeDesc}.`;
  }

  /**
   * Generate an irregular settlement footprint based on size
   * @param centerX - Center X coordinate of the settlement
   * @param centerY - Center Y coordinate of the settlement
   * @param size - Size category of the settlement
   * @param rng - Random number generator function
   * @returns Settlement footprint with irregular shape
   */
  generateSettlementFootprint(
    centerX: number,
    centerY: number,
    size: Settlement['size'],
    rng: () => number,
  ): SettlementFootprint {
    // Determine base radius based on settlement size
    const baseRadius = this.getSettlementRadius(size);

    const tiles: Array<{ x: number; y: number; intensity: number }> = [];

    // Generate multiple center points for organic growth patterns
    const growthCenters = this.generateGrowthCenters(
      centerX,
      centerY,
      size,
      rng,
    );

    // For each potential tile in the area, calculate if it should be part of the settlement
    const searchRadius = Math.ceil(baseRadius * 1.5); // Search a bit beyond base radius

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const x = centerX + dx;
        const y = centerY + dy;

        const intensity = this.calculateTileIntensity(
          x,
          y,
          growthCenters,
          baseRadius,
          rng,
        );

        if (intensity > 0.1) {
          // Only include tiles with meaningful settlement presence
          tiles.push({ x, y, intensity });
        }
      }
    }

    return {
      centerX,
      centerY,
      tiles,
      radius: baseRadius,
    };
  }

  /**
   * Get the base radius for a settlement based on its size
   */
  private getSettlementRadius(size: Settlement['size']): number {
    switch (size) {
      case 'large':
        return 8; // Cities: ~8 tile radius
      case 'medium':
        return 5; // Towns: ~5 tile radius
      case 'small':
        return 3; // Villages: ~3 tile radius
      case 'tiny':
        return 1; // Hamlets/Farms: ~1 tile radius
      default:
        return 1;
    }
  }

  /**
   * Generate growth centers for organic settlement shape
   */
  private generateGrowthCenters(
    centerX: number,
    centerY: number,
    size: Settlement['size'],
    rng: () => number,
  ): Array<{ x: number; y: number; weight: number }> {
    const centers: Array<{ x: number; y: number; weight: number }> = [];

    // Always include the main center
    centers.push({ x: centerX, y: centerY, weight: 1.0 });

    // Add additional growth centers based on size
    const additionalCenters = this.getAdditionalCenterCount(size);

    for (let i = 0; i < additionalCenters; i++) {
      // Generate points around the main center with some randomness
      const angle = rng() * Math.PI * 2;
      const distance = rng() * this.getSettlementRadius(size) * 0.6; // Stay within reasonable bounds

      const x = centerX + Math.round(Math.cos(angle) * distance);
      const y = centerY + Math.round(Math.sin(angle) * distance);
      const weight = 0.3 + rng() * 0.5; // Secondary centers have less influence

      centers.push({ x, y, weight });
    }

    return centers;
  }

  /**
   * Get number of additional growth centers based on settlement size
   */
  private getAdditionalCenterCount(size: Settlement['size']): number {
    switch (size) {
      case 'large':
        return 3; // Cities have multiple districts
      case 'medium':
        return 2; // Towns have a couple areas
      case 'small':
        return 1; // Villages might have one secondary area
      case 'tiny':
        return 0; // Hamlets/farms are compact
      default:
        return 0;
    }
  }

  /**
   * Calculate settlement intensity at a given tile based on distance to growth centers
   */
  private calculateTileIntensity(
    x: number,
    y: number,
    growthCenters: Array<{ x: number; y: number; weight: number }>,
    baseRadius: number,
    rng: () => number,
  ): number {
    let maxIntensity = 0;

    for (const center of growthCenters) {
      const distance = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);

      // Add some noise to make the boundaries irregular
      const noise = (rng() - 0.5) * 0.8; // ±0.4 tiles of noise
      const effectiveDistance = distance + noise;

      if (effectiveDistance <= baseRadius) {
        // Calculate intensity based on distance from center, with falloff
        const falloff = 1 - effectiveDistance / baseRadius;
        const intensity = Math.max(0, falloff * center.weight);

        // Add some randomness to create organic variation
        const variation = 0.8 + rng() * 0.4; // 0.8-1.2 multiplier
        const adjustedIntensity = Math.min(1, intensity * variation);

        maxIntensity = Math.max(maxIntensity, adjustedIntensity);
      }
    }

    return maxIntensity;
  }
}
