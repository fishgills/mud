import type { ChunkData } from './dto';
import type { BiomeInfo } from '@mud/constants';

// Re-export BiomeInfo from @mud/constants for backwards compatibility
export type { BiomeInfo } from '@mud/constants';

export interface TileData {
  x: number;
  y: number;
  height: number;
  temperature: number;
  moisture: number;
  biome: BiomeInfo;
}

export interface WorldSeedConfig {
  heightSeed: number;
  temperatureSeed: number;
  moistureSeed: number;
  heightConfig: NoiseConfig;
  temperatureConfig: NoiseConfig;
  moistureConfig: NoiseConfig;
}

export const DEFAULT_WORLD_CONFIG: Omit<
  WorldSeedConfig,
  'heightSeed' | 'temperatureSeed' | 'moistureSeed'
> = {
  heightConfig: {
    scale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
  },
  temperatureConfig: {
    scale: 0.008,
    octaves: 3,
    persistence: 0.6,
    lacunarity: 2.1,
  },
  moistureConfig: {
    scale: 0.012,
    octaves: 3,
    persistence: 0.4,
    lacunarity: 1.9,
  },
};

export interface NoiseConfig {
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
}

export type { ChunkData };
