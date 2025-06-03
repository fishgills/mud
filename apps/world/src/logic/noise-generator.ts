import { createNoise2D } from 'simplex-noise';

export interface NoiseSettings {
  seed: number;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
}

export interface WorldParameters {
  heightNoise: NoiseSettings;
  temperatureNoise: NoiseSettings;
  moistureNoise: NoiseSettings;
}

export interface TerrainData {
  height: number;     // 0-1 (0 = sea level, 1 = mountain peak)
  temperature: number; // 0-1 (0 = cold, 1 = hot)
  moisture: number;   // 0-1 (0 = dry, 1 = wet)
}

export class NoiseGenerator {
  private heightNoise: (x: number, y: number) => number;
  private temperatureNoise: (x: number, y: number) => number;
  private moistureNoise: (x: number, y: number) => number;
  private parameters: WorldParameters;

  constructor(parameters: WorldParameters) {
    this.parameters = parameters;
    
    // Create deterministic noise functions based on seeds
    this.heightNoise = createNoise2D(() => parameters.heightNoise.seed);
    this.temperatureNoise = createNoise2D(() => parameters.temperatureNoise.seed);
    this.moistureNoise = createNoise2D(() => parameters.moistureNoise.seed);
  }

  /**
   * Generate terrain data for a specific world coordinate
   */
  generateTerrain(x: number, y: number): TerrainData {
    return {
      height: this.generateOctaveNoise(x, y, this.heightNoise, this.parameters.heightNoise),
      temperature: this.generateOctaveNoise(x, y, this.temperatureNoise, this.parameters.temperatureNoise),
      moisture: this.generateOctaveNoise(x, y, this.moistureNoise, this.parameters.moistureNoise)
    };
  }

  /**
   * Generate noise with multiple octaves for more realistic terrain
   */
  private generateOctaveNoise(
    x: number, 
    y: number, 
    noiseFunc: (x: number, y: number) => number,
    settings: NoiseSettings
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = settings.scale;
    let maxValue = 0;

    for (let i = 0; i < settings.octaves; i++) {
      value += noiseFunc(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= settings.persistence;
      frequency *= settings.lacunarity;
    }

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, (value / maxValue + 1) / 2));
  }

  /**
   * Generate terrain data for an entire chunk
   */
  generateChunkTerrain(chunkX: number, chunkY: number, chunkSize: number): TerrainData[][] {
    const terrain: TerrainData[][] = [];
    
    for (let x = 0; x < chunkSize; x++) {
      terrain[x] = [];
      for (let y = 0; y < chunkSize; y++) {
        const worldX = chunkX * chunkSize + x;
        const worldY = chunkY * chunkSize + y;
        terrain[x][y] = this.generateTerrain(worldX, worldY);
      }
    }
    
    return terrain;
  }
}
