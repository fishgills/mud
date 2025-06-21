import { Settlement, WorldTile } from '@mud/database';

export interface TileData {
  x: number;
  y: number;
  height: number;
  temperature: number;
  moisture: number;
  biome: BiomeInfo;
}

export interface BiomeInfo {
  id: number;
  name: string;
  description: string;
  color: string; // For rendering
  ascii: string; // Single character for ASCII rendering
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

export interface SettlementFootprint {
  centerX: number;
  centerY: number;
  tiles: Array<{ x: number; y: number; intensity: number }>; // intensity 0-1 for settlement density
  radius: number;
}

export interface SettlementTileInfo {
  isSettlement: boolean;
  settlementName?: string;
  settlementType?: string;
  intensity: number; // 0-1, how much of this tile is settlement
}

// Extended Settlement type for internal use with footprint
export interface SettlementWithFootprint extends Settlement {
  footprint?: SettlementFootprint;
}

export interface ChunkData {
  tiles: WorldTile[];
  settlements: Settlement[];
  stats: {
    biomes: Record<string, number>;
    averageHeight: number;
    averageTemperature: number;
    averageMoisture: number;
  };
}
