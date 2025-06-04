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
 * Generator for settlements and landmarks in the world
 */
export class SettlementGenerator {
  private noiseGenerator: NoiseGenerator;

  constructor(
    worldParams: WorldParameters = DEFAULT_WORLD_CONFIG.worldParameters
  ) {
    this.noiseGenerator = new NoiseGenerator(worldParams);
  }

  /**
   * Generate settlements for a given region
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
        const settlement = this.generateSettlement(
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
   * Generate landmarks for a given region
   */
  generateLandmarks(region: RegionInfo, settlements: Settlement[]): Landmark[] {
    const landmarks: Landmark[] = [];
    const area = region.width * region.height;
    const baseArea = 1000000; // 1000x1000 reference area
    const count = Math.round(LANDMARK_CONFIG.density * (area / baseArea));

    for (let i = 0; i < count; i++) {
      const landmark = this.generateLandmark(
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

  private generateSettlement(
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

  private generateLandmark(
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

  private generateLandmarkName(type: LandmarkType): string {
    const names = LANDMARK_NAMES[type];
    if (!names || names.length === 0) {
      return `Mysterious ${type.replace('_', ' ')}`;
    }

    return names[Math.floor(Math.random() * names.length)];
  }
}
