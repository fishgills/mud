import seedrandom from 'seedrandom';
import { BiomeInfo, BIOMES } from './biome';

export interface SettlementInfo {
  name: string;
  type: 'city' | 'town' | 'village' | 'hamlet' | 'farm';
  size: 'large' | 'medium' | 'small' | 'tiny';
  population: number;
  x: number;
  y: number;
  description: string;
}

// Settlement name pools
const SETTLEMENT_PREFIXES = [
  'Old',
  'New',
  'North',
  'South',
  'East',
  'West',
  'Upper',
  'Lower',
  'Great',
  'Little',
  'High',
  'Deep',
  'Green',
  'Red',
  'White',
  'Black',
  'Silver',
  'Golden',
  'Iron',
  'Stone',
];

const SETTLEMENT_ROOTS = [
  'haven',
  'ford',
  'bridge',
  'hill',
  'vale',
  'moor',
  'wood',
  'field',
  'gate',
  'port',
  'brook',
  'marsh',
  'grove',
  'ridge',
  'peak',
  'hollow',
  'meadow',
  'springs',
  'falls',
  'rock',
  'castle',
  'tower',
  'keep',
  'hall',
  'court',
  'manor',
  'mill',
  'cross',
  'chapel',
  'abbey',
];

const SETTLEMENT_SUFFIXES = [
  'ton',
  'ham',
  'burg',
  'wick',
  'by',
  'thorpe',
  'ford',
  'stead',
  'worth',
  'field',
  'wood',
  'hill',
  'dale',
  'mount',
  'view',
  'side',
  'end',
  'land',
  'mere',
  'shire',
];

/**
 * SettlementGenerator is responsible for generating settlements based on coordinates and biome information.
 * It uses a seeded random number generator to ensure deterministic results.
 * Settlement generation is influenced by the biome type and coordinates, allowing for unique settlement names and characteristics.
 */
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
  generateSettlement(x: number, y: number, biome: BiomeInfo): SettlementInfo {
    // Create deterministic randomness based on coordinates
    const coordSeed = x * 1000 + y + this.seed;
    const coordRng = seedrandom(coordSeed.toString());

    const name = this.generateSettlementName(coordRng);
    const { type, size, population } = this.determineSettlementSize(
      coordRng,
      biome
    );
    const description = this.generateSettlementDescription(
      type,
      biome,
      coordRng
    );

    return {
      name,
      type,
      size,
      population,
      x,
      y,
      description,
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
    biome: BiomeInfo
  ): {
    type: SettlementInfo['type'];
    size: SettlementInfo['size'];
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
    type: SettlementInfo['type'],
    biome: BiomeInfo,
    rng: () => number
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

    const biomeDescriptions = {
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
      baseDescriptions[type][Math.floor(rng() * baseDescriptions[type].length)];
    const biomeDesc = biomeDescriptions[biome.name] || 'in a remote location';

    return `${baseDesc} ${biomeDesc}.`;
  }
}
