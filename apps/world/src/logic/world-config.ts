import { WorldParameters } from './noise-generator';

/**
 * World generation configuration
 * Modify these values to change how the world is generated
 */
export interface WorldConfig {
  // World generation parameters
  worldParameters: WorldParameters;
  
  // Chunk settings
  chunkSize: number;
  
  // Settlement placement
  settlementSpacing: number;
  cityProbability: number;
  villageProbability: number;
  
  // Biome preferences (can be used to bias certain biomes)
  biomeWeights?: Record<string, number>;
}

// Default configuration for a balanced fantasy world
export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  worldParameters: {
    heightNoise: {
      seed: 12345,
      scale: 0.01,     // Larger scale = bigger features
      octaves: 6,      // More octaves = more detail
      persistence: 0.5, // How much each octave contributes
      lacunarity: 2.0   // Frequency multiplier between octaves
    },
    temperatureNoise: {
      seed: 54321,
      scale: 0.005,    // Very large temperature zones
      octaves: 4,
      persistence: 0.6,
      lacunarity: 2.0
    },
    moistureNoise: {
      seed: 98765,
      scale: 0.008,    // Medium-sized moisture patterns
      octaves: 5,
      persistence: 0.4,
      lacunarity: 2.0
    }
  },
  chunkSize: 20,
  settlementSpacing: 50,
  cityProbability: 0.002,    // 0.2% chance per suitable tile
  villageProbability: 0.01   // 1% chance per suitable tile
};

// Alternative configuration for a more mountainous world
export const MOUNTAINOUS_WORLD_CONFIG: WorldConfig = {
  ...DEFAULT_WORLD_CONFIG,
  worldParameters: {
    heightNoise: {
      seed: 12345,
      scale: 0.008,    // Slightly smaller height features
      octaves: 8,      // More height detail
      persistence: 0.7, // More prominent height differences
      lacunarity: 2.2
    },
    temperatureNoise: {
      ...DEFAULT_WORLD_CONFIG.worldParameters.temperatureNoise,
      scale: 0.006     // Slightly more varied temperature
    },
    moistureNoise: {
      ...DEFAULT_WORLD_CONFIG.worldParameters.moistureNoise,
      scale: 0.01      // More varied moisture patterns
    }
  }
};

// Alternative configuration for an island world
export const ISLAND_WORLD_CONFIG: WorldConfig = {
  ...DEFAULT_WORLD_CONFIG,
  worldParameters: {
    heightNoise: {
      seed: 12345,
      scale: 0.003,    // Very large landmass features
      octaves: 4,      // Less height detail for smoother islands
      persistence: 0.3,
      lacunarity: 1.8
    },
    temperatureNoise: {
      ...DEFAULT_WORLD_CONFIG.worldParameters.temperatureNoise,
      scale: 0.004     // Large temperature zones
    },
    moistureNoise: {
      ...DEFAULT_WORLD_CONFIG.worldParameters.moistureNoise,
      scale: 0.006     // Varied moisture for different island climates
    }
  },
  settlementSpacing: 30,     // Closer settlements on islands
  cityProbability: 0.001,    // Fewer cities
  villageProbability: 0.015  // More villages
};

/**
 * Get world configuration by name
 */
export function getWorldConfig(configName: string): WorldConfig {
  switch (configName.toLowerCase()) {
    case 'mountainous':
      return MOUNTAINOUS_WORLD_CONFIG;
    case 'island':
      return ISLAND_WORLD_CONFIG;
    case 'default':
    default:
      return DEFAULT_WORLD_CONFIG;
  }
}
