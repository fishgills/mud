import { BIOMES } from '../constants';
import { BiomeInfo } from '../world/types';

export class BiomeGenerator {
  static determineBiome(
    height: number,
    temperature: number,
    moisture: number,
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
    moisture: number,
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
