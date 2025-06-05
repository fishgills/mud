import {
  Settlement,
  Landmark,
  SettlementType,
  SettlementSize,
  LandmarkType,
  SETTLEMENT_CONFIG,
  LANDMARK_CONFIG,
  SETTLEMENT_NAMES,
  LANDMARK_NAMES,
} from './settlement-definitions';
import { NoiseGenerator, WorldParameters } from './noise-generator';
import { BiomeMapper } from './biome-mapper';
import { DEFAULT_WORLD_CONFIG } from './world-config';

export interface RegionInfo {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/**
 * Deterministic generator for settlements and landmarks in the world
 * Uses chunk-based seeds to ensure the same structures are always generated
 * for the same world coordinates
 */
export class SettlementGenerator {
  private noiseGenerator: NoiseGenerator;

  constructor(
    worldParams: WorldParameters = DEFAULT_WORLD_CONFIG.worldParameters
  ) {
    this.noiseGenerator = new NoiseGenerator(worldParams);
  }

  /**
   * Generate settlements for a chunk using deterministic seeding
   */
  generateSettlementsForChunk(
    chunkX: number,
    chunkY: number,
    chunkSize: number
  ): Settlement[] {
    const settlements: Settlement[] = [];

    // Create deterministic random generator for this chunk
    const chunkSeed = this.createChunkSeed(chunkX, chunkY, 'settlement');
    const random = this.createSeededRandom(chunkSeed);

    // Calculate chunk boundaries
    const startX = chunkX * chunkSize;
    const startY = chunkY * chunkSize;
    const endX = startX + chunkSize - 1;
    const endY = startY + chunkSize - 1;

    // For each settlement type, check if this chunk should contain one
    for (const [type, density] of Object.entries(SETTLEMENT_CONFIG.density)) {
      const settlementType = type as SettlementType;

      // Calculate probability for this chunk based on density
      // density is per 1M tiles, so scale down for chunk size
      const chunkArea = chunkSize * chunkSize;
      const baseArea = 1000000; // 1000x1000 reference area
      const scaledDensity = density * (chunkArea / baseArea);

      // Use deterministic random to decide if this chunk gets a settlement
      if (random() < scaledDensity) {
        const settlement = this.generateSettlementInBounds(
          settlementType,
          startX,
          endX,
          startY,
          endY,
          settlements,
          random
        );
        if (settlement) {
          settlements.push(settlement);
        }
      }
    }

    return settlements;
  }

  /**
   * Generate landmarks for a chunk using deterministic seeding
   */
  generateLandmarksForChunk(
    chunkX: number,
    chunkY: number,
    chunkSize: number,
    settlements: Settlement[]
  ): Landmark[] {
    const landmarks: Landmark[] = [];

    // Create deterministic random generator for this chunk
    const chunkSeed = this.createChunkSeed(chunkX, chunkY, 'landmark');
    const random = this.createSeededRandom(chunkSeed);

    // Calculate chunk boundaries
    const startX = chunkX * chunkSize;
    const startY = chunkY * chunkSize;
    const endX = startX + chunkSize - 1;
    const endY = startY + chunkSize - 1;

    // Calculate how many landmarks this chunk should have
    const chunkArea = chunkSize * chunkSize;
    const baseArea = 1000000; // 1000x1000 reference area
    const expectedLandmarks = Math.round(
      LANDMARK_CONFIG.density * (chunkArea / baseArea)
    );

    // Generate landmarks with some randomness around the expected count
    const actualCount = Math.max(
      0,
      expectedLandmarks + Math.floor((random() - 0.5) * 3)
    );

    for (let i = 0; i < actualCount; i++) {
      const landmark = this.generateLandmarkInBounds(
        startX,
        endX,
        startY,
        endY,
        settlements,
        landmarks,
        random
      );
      if (landmark) {
        landmarks.push(landmark);
      }
    }

    return landmarks;
  }

  /**
   * Generate settlements for a given region (legacy API for compatibility)
   */
  generateSettlements(region: RegionInfo): Settlement[] {
    const settlements: Settlement[] = [];
    const area = region.width * region.height;
    const baseArea = 1000000; // 1000x1000 reference area

    // Calculate how many settlements to generate based on area
    const scaleFactor = area / baseArea;

    for (const [type, density] of Object.entries(SETTLEMENT_CONFIG.density)) {
      const count = Math.round(density * scaleFactor);
      const settlementType = type as SettlementType;

      for (let i = 0; i < count; i++) {
        const settlement = this.generateSettlementForRegion(
          region,
          settlementType,
          settlements
        );
        if (settlement) {
          settlements.push(settlement);
        }
      }
    }

    return settlements;
  }

  /**
   * Generate landmarks for a given region (legacy API for compatibility)
   */
  generateLandmarks(region: RegionInfo, settlements: Settlement[]): Landmark[] {
    const landmarks: Landmark[] = [];
    const area = region.width * region.height;
    const baseArea = 1000000; // 1000x1000 reference area
    const count = Math.round(LANDMARK_CONFIG.density * (area / baseArea));

    for (let i = 0; i < count; i++) {
      const landmark = this.generateLandmarkForRegion(
        region,
        [...settlements],
        landmarks
      );
      if (landmark) {
        landmarks.push(landmark);
      }
    }

    return landmarks;
  }

  /**
   * Create a deterministic seed for a chunk
   */
  private createChunkSeed(
    chunkX: number,
    chunkY: number,
    type: 'settlement' | 'landmark'
  ): number {
    // Use the world generation seed as base
    const baseSeed = DEFAULT_WORLD_CONFIG.worldParameters.heightNoise.seed;
    const typeOffset = type === 'settlement' ? 10000 : 20000;
    return baseSeed + chunkX * 1000000 + chunkY * 1000 + typeOffset;
  }

  /**
   * Create a seeded pseudo-random number generator
   */
  private createSeededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  /**
   * Generate a settlement within specific bounds using a seeded random generator
   */
  private generateSettlementInBounds(
    type: SettlementType,
    startX: number,
    endX: number,
    startY: number,
    endY: number,
    existingSettlements: Settlement[],
    random: () => number
  ): Settlement | null {
    const maxAttempts = 50; // Fewer attempts since we're working within a chunk

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random position within bounds
      const x = startX + Math.floor(random() * (endX - startX + 1));
      const y = startY + Math.floor(random() * (endY - startY + 1));

      // Check distance from existing settlements
      if (!this.isValidSettlementLocation(x, y, type, existingSettlements)) {
        continue;
      }

      // Get terrain data for this location
      const terrain = this.noiseGenerator.generateTerrain(x, y);
      const biomeName = BiomeMapper.getBiome(terrain);

      // Check if biome is suitable for settlements
      const biomePreference =
        (SETTLEMENT_CONFIG.biomePreferences as Record<string, number>)[
          biomeName
        ] || 0;
      if (biomePreference === 0) {
        continue; // This biome doesn't support settlements
      }

      // Use biome preference as probability (higher preference = more likely)
      const probability = biomePreference / 10; // Normalize to 0-1
      if (random() > probability) {
        continue;
      }

      // Generate settlement properties using seeded random
      const name = this.generateSettlementNameSeeded(random);
      const [minPop, maxPop] = SETTLEMENT_CONFIG.populationRanges[type];
      const population = Math.floor(random() * (maxPop - minPop + 1)) + minPop;

      let size: SettlementSize;
      if (population >= 5000) size = SettlementSize.LARGE;
      else if (population >= 1000) size = SettlementSize.MEDIUM;
      else if (population >= 200) size = SettlementSize.SMALL;
      else size = SettlementSize.TINY;

      return {
        id: 0, // Will be set when stored in database
        name,
        type,
        x,
        y,
        size,
        population,
        description: `${name} is a ${type} with ${population} inhabitants, situated in the ${biomeName}.`,
      };
    }

    return null; // Failed to find suitable location
  }

  /**
   * Generate a landmark within specific bounds using a seeded random generator
   */
  private generateLandmarkInBounds(
    startX: number,
    endX: number,
    startY: number,
    endY: number,
    settlements: Settlement[],
    existingLandmarks: Landmark[],
    random: () => number
  ): Landmark | null {
    const maxAttempts = 50; // Fewer attempts since we're working within a chunk

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random position within bounds
      const x = startX + Math.floor(random() * (endX - startX + 1));
      const y = startY + Math.floor(random() * (endY - startY + 1));

      // Check distance from existing landmarks and settlements
      if (!this.isValidLandmarkLocation(x, y, settlements, existingLandmarks)) {
        continue;
      }

      // Get terrain data for this location
      const terrain = this.noiseGenerator.generateTerrain(x, y);
      const biomeName = BiomeMapper.getBiome(terrain);

      // Select landmark type based on biome preferences and weights
      const landmarkType = this.selectLandmarkTypeSeeded(biomeName, random);
      if (!landmarkType) {
        continue;
      }

      const name = this.generateLandmarkNameSeeded(landmarkType, random);

      return {
        id: 0, // Will be set when stored in database
        name,
        type: landmarkType,
        x,
        y,
        description: `${name} stands in the ${biomeName}, a place of ancient significance.`,
      };
    }

    return null; // Failed to find suitable location
  }

  /**
   * Generate a single settlement for a region (helper for legacy API)
   */
  private generateSettlementForRegion(
    region: RegionInfo,
    type: SettlementType,
    existingSettlements: Settlement[]
  ): Settlement | null {
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random position in region
      const x =
        region.centerX - region.width / 2 + Math.random() * region.width;
      const y =
        region.centerY - region.height / 2 + Math.random() * region.height;

      // Check distance from existing settlements
      if (!this.isValidSettlementLocation(x, y, type, existingSettlements)) {
        continue;
      }

      // Get terrain data for this location
      const terrain = this.noiseGenerator.generateTerrain(x, y);
      const biomeName = BiomeMapper.getBiome(terrain);

      // Check if biome is suitable for settlements
      const biomePreference =
        (SETTLEMENT_CONFIG.biomePreferences as Record<string, number>)[
          biomeName
        ] || 0;
      if (biomePreference === 0) {
        continue; // This biome doesn't support settlements
      }

      // Use biome preference as probability (higher preference = more likely)
      const probability = biomePreference / 10; // Normalize to 0-1
      if (Math.random() > probability) {
        continue;
      }

      // Generate settlement properties
      const name = this.generateSettlementName();
      const [minPop, maxPop] = SETTLEMENT_CONFIG.populationRanges[type];
      const population =
        Math.floor(Math.random() * (maxPop - minPop + 1)) + minPop;

      let size: SettlementSize;
      if (population >= 5000) size = SettlementSize.LARGE;
      else if (population >= 1000) size = SettlementSize.MEDIUM;
      else if (population >= 200) size = SettlementSize.SMALL;
      else size = SettlementSize.TINY;

      return {
        id: Date.now() + Math.random(), // Temporary ID
        name,
        type,
        x: Math.round(x),
        y: Math.round(y),
        size,
        population,
        description: `${name} is a ${type} with ${population} inhabitants, situated in the ${biomeName}.`,
      };
    }

    return null; // Failed to find suitable location
  }

  /**
   * Generate a single landmark for a region (helper for legacy API)
   */
  private generateLandmarkForRegion(
    region: RegionInfo,
    settlements: Settlement[],
    existingLandmarks: Landmark[]
  ): Landmark | null {
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random position in region
      const x =
        region.centerX - region.width / 2 + Math.random() * region.width;
      const y =
        region.centerY - region.height / 2 + Math.random() * region.height;

      // Check distance from existing landmarks and settlements
      if (!this.isValidLandmarkLocation(x, y, settlements, existingLandmarks)) {
        continue;
      }

      // Get terrain data for this location
      const terrain = this.noiseGenerator.generateTerrain(x, y);
      const biomeName = BiomeMapper.getBiome(terrain);

      // Select landmark type based on biome preferences and weights
      const landmarkType = this.selectLandmarkType(biomeName);
      if (!landmarkType) {
        continue;
      }

      const name = this.generateLandmarkName(landmarkType);

      return {
        id: Date.now() + Math.random(), // Temporary ID
        name,
        type: landmarkType,
        x: Math.round(x),
        y: Math.round(y),
        description: `${name} stands in the ${biomeName}, a place of ancient significance.`,
      };
    }

    return null; // Failed to find suitable location
  }

  private isValidSettlementLocation(
    x: number,
    y: number,
    type: SettlementType,
    existingSettlements: Settlement[]
  ): boolean {
    const minDistance = SETTLEMENT_CONFIG.minDistances[type];

    for (const settlement of existingSettlements) {
      const distance = Math.sqrt(
        Math.pow(x - settlement.x, 2) + Math.pow(y - settlement.y, 2)
      );

      // Check minimum distance based on the larger settlement type
      const requiredDistance = Math.max(
        minDistance,
        SETTLEMENT_CONFIG.minDistances[settlement.type]
      );

      if (distance < requiredDistance) {
        return false;
      }
    }

    return true;
  }

  private isValidLandmarkLocation(
    x: number,
    y: number,
    settlements: Settlement[],
    existingLandmarks: Landmark[]
  ): boolean {
    // Check distance from existing landmarks
    for (const landmark of existingLandmarks) {
      const distance = Math.sqrt(
        Math.pow(x - landmark.x, 2) + Math.pow(y - landmark.y, 2)
      );
      if (distance < LANDMARK_CONFIG.minDistance) {
        return false;
      }
    }

    // Check distance from settlements (landmarks should not be too close to settlements)
    for (const settlement of settlements) {
      const distance = Math.sqrt(
        Math.pow(x - settlement.x, 2) + Math.pow(y - settlement.y, 2)
      );
      // Minimum distance is half the settlement's minimum distance
      const minDistance = SETTLEMENT_CONFIG.minDistances[settlement.type] / 2;
      if (distance < minDistance) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate settlement name using seeded random
   */
  private generateSettlementNameSeeded(random: () => number): string {
    const usePrefix = random() < 0.3;
    const useSuffix = random() < 0.7;

    let name = '';

    if (usePrefix) {
      const prefix =
        SETTLEMENT_NAMES.prefixes[
          Math.floor(random() * SETTLEMENT_NAMES.prefixes.length)
        ];
      name += prefix;
    }

    const root =
      SETTLEMENT_NAMES.roots[
        Math.floor(random() * SETTLEMENT_NAMES.roots.length)
      ];
    name += (name ? ' ' : '') + root;

    if (useSuffix && !name.includes(root)) {
      const suffix =
        SETTLEMENT_NAMES.suffixes[
          Math.floor(random() * SETTLEMENT_NAMES.suffixes.length)
        ];
      name += suffix;
    }

    // Capitalize first letter of each word
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate landmark name using seeded random
   */
  private generateLandmarkNameSeeded(
    type: LandmarkType,
    random: () => number
  ): string {
    const names = LANDMARK_NAMES[type];
    if (!names || names.length === 0) {
      return `Mysterious ${type.replace('_', ' ')}`;
    }

    return names[Math.floor(random() * names.length)];
  }

  /**
   * Select landmark type based on biome preferences using seeded random
   */
  private selectLandmarkTypeSeeded(
    biomeName: string,
    random: () => number
  ): LandmarkType | null {
    // Filter landmark types that are suitable for this biome
    const suitableTypes: { type: LandmarkType; weight: number }[] = [];

    for (const [type, weight] of Object.entries(LANDMARK_CONFIG.typeWeights)) {
      const landmarkType = type as LandmarkType;
      const preferredBiomes =
        LANDMARK_CONFIG.biomePreferences[landmarkType] || [];

      if (preferredBiomes.length === 0 || preferredBiomes.includes(biomeName)) {
        suitableTypes.push({ type: landmarkType, weight });
      }
    }

    if (suitableTypes.length === 0) {
      return null;
    }

    // Weighted random selection using seeded random
    const totalWeight = suitableTypes.reduce(
      (sum, item) => sum + item.weight,
      0
    );
    let randomValue = random() * totalWeight;

    for (const item of suitableTypes) {
      randomValue -= item.weight;
      if (randomValue <= 0) {
        return item.type;
      }
    }

    return suitableTypes[0].type; // Fallback
  }

  /**
   * Generate settlement name (legacy helper)
   */
  private generateSettlementName(): string {
    const usePrefix = Math.random() < 0.3;
    const useSuffix = Math.random() < 0.7;

    let name = '';

    if (usePrefix) {
      const prefix =
        SETTLEMENT_NAMES.prefixes[
          Math.floor(Math.random() * SETTLEMENT_NAMES.prefixes.length)
        ];
      name += prefix;
    }

    const root =
      SETTLEMENT_NAMES.roots[
        Math.floor(Math.random() * SETTLEMENT_NAMES.roots.length)
      ];
    name += (name ? ' ' : '') + root;

    if (useSuffix && !name.includes(root)) {
      const suffix =
        SETTLEMENT_NAMES.suffixes[
          Math.floor(Math.random() * SETTLEMENT_NAMES.suffixes.length)
        ];
      name += suffix;
    }

    // Capitalize first letter of each word
    return name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate landmark name (legacy helper)
   */
  private generateLandmarkName(type: LandmarkType): string {
    const names = LANDMARK_NAMES[type];
    if (!names || names.length === 0) {
      return `Mysterious ${type.replace('_', ' ')}`;
    }

    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Select landmark type based on biome preferences (legacy helper)
   */
  private selectLandmarkType(biomeName: string): LandmarkType | null {
    // Filter landmark types that are suitable for this biome
    const suitableTypes: { type: LandmarkType; weight: number }[] = [];

    for (const [type, weight] of Object.entries(LANDMARK_CONFIG.typeWeights)) {
      const landmarkType = type as LandmarkType;
      const preferredBiomes =
        LANDMARK_CONFIG.biomePreferences[landmarkType] || [];

      if (preferredBiomes.length === 0 || preferredBiomes.includes(biomeName)) {
        suitableTypes.push({ type: landmarkType, weight });
      }
    }

    if (suitableTypes.length === 0) {
      return null;
    }

    // Weighted random selection
    const totalWeight = suitableTypes.reduce(
      (sum, item) => sum + item.weight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const item of suitableTypes) {
      random -= item.weight;
      if (random <= 0) {
        return item.type;
      }
    }

    return suitableTypes[0].type; // Fallback
  }
}
