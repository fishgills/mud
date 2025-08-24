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
    attrs?: { type?: Settlement['type']; population?: number },
  ): SettlementFootprint {
    // Determine base radius based on population, type, and size
    const baseRadius = this.getSettlementRadius(
      size,
      attrs?.type,
      attrs?.population,
    );

    const tiles: Array<{ x: number; y: number; intensity: number }> = [];

    // Deterministic growth centers for organic shapes (seeded by center + global seed)
    const growthCenters = this.generateGrowthCenters(
      centerX,
      centerY,
      size,
      baseRadius,
    );

    // For each potential tile in the area, calculate if it should be part of the settlement
    const searchRadius = Math.ceil(baseRadius * 1.6); // Search a bit beyond base radius

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const x = centerX + dx;
        const y = centerY + dy;

        const intensity = this.calculateTileIntensity(
          x,
          y,
          centerX,
          centerY,
          growthCenters,
          baseRadius,
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
  private getSettlementRadius(
    size: Settlement['size'],
    type?: Settlement['type'],
    population?: number,
  ): number {
    // Each tile is 100m x 100m = 1 hectare
    // Use approximate population densities (people per tile/hectare) by type
    const densityByType: Record<Settlement['type'], number> = {
      city: 60, // dense urban core
      town: 35, // mixed urban
      village: 18, // compact rural center
      hamlet: 10, // sparse cluster
      farm: 4, // homestead + immediate yard, fields not modeled
    } as const;

    // Fallback density by size if type is missing
    const densityBySize: Record<Settlement['size'], number> = {
      large: 60,
      medium: 35,
      small: 18,
      tiny: 10,
    } as const;

    // Minimum radius by size to ensure noticeable footprint
    const minRadiusBySize: Record<Settlement['size'], number> = {
      large: 6,
      medium: 4,
      small: 2.5,
      tiny: 1.5,
    } as const;

    // If no population provided, fall back to legacy size-based radius
    if (!population || population <= 0) {
      switch (size) {
        case 'large':
          return 8;
        case 'medium':
          return 5;
        case 'small':
          return 3;
        case 'tiny':
          return 1.5;
        default:
          return 1.5;
      }
    }

    // Compute area in tiles (hectares) using density
    const density = type ? densityByType[type] : (densityBySize[size] ?? 12);
    const areaTiles = Math.max(1, population / Math.max(1, density));

    // Convert area to an equivalent circular radius and smooth slightly
    const radius = Math.sqrt(areaTiles / Math.PI);

    // Clamp to reasonable bounds and enforce size-based minimums
    const minR = minRadiusBySize[size] ?? 1.5;
    const maxR = 20; // avoid extreme blobs
    const adjusted = Math.max(minR, Math.min(maxR, radius));
    return adjusted;
  }

  /**
   * Generate growth centers for organic settlement shape
   */
  private generateGrowthCenters(
    centerX: number,
    centerY: number,
    size: Settlement['size'],
    baseRadius: number,
  ): Array<{ x: number; y: number; weight: number }> {
    const centers: Array<{ x: number; y: number; weight: number }> = [];

    // Always include the main center
    centers.push({ x: centerX, y: centerY, weight: 1.0 });

    // Add additional growth centers based on size
    const additionalCenters = this.getAdditionalCenterCount(size);

    for (let i = 0; i < additionalCenters; i++) {
      // Deterministic angle and distance based on seed + coords + index
      const angle = this.noise1D(centerX, centerY, i * 17 + 1) * Math.PI * 2;
      const distance =
        (0.25 + 0.45 * this.noise1D(centerX, centerY, i * 31 + 7)) * baseRadius;

      // Keep sub-centers on fractional coordinates for smoother lobes
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      const weight = 0.45 + 0.45 * this.noise1D(centerX, centerY, i * 47 + 13); // 0.45 - 0.9

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
    centerX: number,
    centerY: number,
    growthCenters: Array<{ x: number; y: number; weight: number }>,
    baseRadius: number,
  ): number {
    // Local radius modulation to create wavy/irregular boundary around the main center
    const localRadiusMod =
      0.85 + 0.3 * this.noise2D(centerX, centerY, x, y, 101);
    const mainLocalRadius = baseRadius * localRadiusMod;

    const dx0 = x - centerX;
    const dy0 = y - centerY;
    const distMain = Math.sqrt(dx0 * dx0 + dy0 * dy0);
    let intensity = Math.max(0, 1 - distMain / mainLocalRadius);

    // Add lobes from growth centers with their own local radius and weight
    for (let i = 0; i < growthCenters.length; i++) {
      const c = growthCenters[i];
      const dx = x - c.x;
      const dy = y - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      // Per-center local radius modulation for this tile
      const perCenterMod =
        0.9 + 0.25 * this.noise2D(centerX, centerY, x, y, 200 + i);
      const lobeRadius = baseRadius * (0.55 + 0.45 * c.weight) * perCenterMod;

      const lobeIntensity = Math.max(0, 1 - d / lobeRadius);
      intensity = Math.max(intensity, lobeIntensity);
    }

    // Final small stochastic variation to avoid plateaus
    const microVar = 0.95 + 0.1 * this.noise2D(centerX, centerY, x, y, 307);
    return Math.min(1, intensity * microVar);
  }

  // --- Deterministic noise helpers (fast, seed + coord-based) ---
  private _hash32(n: number): number {
    // Robert Jenkins' 32 bit integer hash variant
    n = (n + 0x7ed55d16 + (n << 12)) | 0;
    n = n ^ 0xc761c23c ^ (n >>> 19);
    n = (n + 0x165667b1 + (n << 5)) | 0;
    n = (n + 0xd3a2646c) ^ (n << 9);
    n = (n + 0xfd7046c5 + (n << 3)) | 0;
    n = n ^ 0xb55a4f09 ^ (n >>> 16);
    return n >>> 0; // as unsigned
  }

  private noise1D(centerX: number, centerY: number, k: number): number {
    // Combine seed + center coords + k into a 32-bit state
    const a = this._hash32(
      (this.seed | 0) ^ (centerX * 73856093) ^ (centerY * 19349663),
    );
    const b = this._hash32(a ^ (k * 83492791));
    return (b & 0xffffffff) / 0x100000000; // [0,1)
  }

  private noise2D(
    centerX: number,
    centerY: number,
    x: number,
    y: number,
    salt: number,
  ): number {
    let s = this._hash32(
      (this.seed | 0) ^ (centerX * 2654435761) ^ (centerY * 1597334677),
    );
    s = this._hash32(
      s ^ (x * 374761393) ^ (y * 1103515245) ^ (salt * 1013904223),
    );
    return (s & 0xffffffff) / 0x100000000; // [0,1)
  }
}
