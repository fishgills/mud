import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { NoiseConfig, WorldSeedConfig } from '../world/types';

export class NoiseGenerator {
  private heightNoise: (x: number, y: number) => number;
  private temperatureNoise: (x: number, y: number) => number;
  private moistureNoise: (x: number, y: number) => number;
  private config: WorldSeedConfig;

  constructor(config: WorldSeedConfig) {
    this.config = config;

    // Create noise functions with seeded PRNGs
    this.heightNoise = createNoise2D(() =>
      seedrandom(config.heightSeed.toString())(),
    );
    this.temperatureNoise = createNoise2D(() =>
      seedrandom(config.temperatureSeed.toString())(),
    );
    this.moistureNoise = createNoise2D(() =>
      seedrandom(config.moistureSeed.toString())(),
    );
  }

  generateHeight(x: number, y: number): number {
    return this.generateOctaveNoise(
      x,
      y,
      this.heightNoise,
      this.config.heightConfig,
    );
  }

  generateTemperature(x: number, y: number): number {
    // Base temperature affected by latitude (y coordinate)
    const latitudeFactor = Math.abs(y / 1000) * 0.5; // Colder towards poles
    const noiseValue = this.generateOctaveNoise(
      x,
      y,
      this.temperatureNoise,
      this.config.temperatureConfig,
    );
    return Math.max(0, Math.min(1, noiseValue - latitudeFactor));
  }

  generateMoisture(x: number, y: number): number {
    return this.generateOctaveNoise(
      x,
      y,
      this.moistureNoise,
      this.config.moistureConfig,
    );
  }

  private generateOctaveNoise(
    x: number,
    y: number,
    noiseFunc: (x: number, y: number) => number,
    config: NoiseConfig,
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = config.scale;
    let maxValue = 0;

    for (let i = 0; i < config.octaves; i++) {
      value += noiseFunc(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= config.persistence;
      frequency *= config.lacunarity;
    }

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, (value / maxValue + 1) / 2));
  }
}
