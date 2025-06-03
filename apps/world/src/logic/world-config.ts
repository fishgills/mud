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
  settlementSpacing: 50, // Minimum distance between settlements
  cityProbability: 0.008, // 1% chance of a city in any chunk
  villageProbability: 0.001, // 5% chance of a village in any chunk
};

