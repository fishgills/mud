// Noise generation utilities using simplex-noise
import { createNoise2D } from 'simplex-noise';

export interface NoiseLayers {
  terrain: (x: number, y: number) => number;
  temperature: (x: number, y: number) => number;
  moisture: (x: number, y: number) => number;
}

// Use a seeded random function for deterministic results
// For now, Math.random is used, but you can use a seeded RNG for true determinism
// e.g., use 'alea' or 'seedrandom' for a seeded random function
export function createNoiseLayers(seed: string): NoiseLayers {
  return {
    terrain: createNoise2D(),
    temperature: createNoise2D(),
    moisture: createNoise2D(),
  };
}

export function getTileNoise(
  x: number,
  y: number,
  noise: NoiseLayers
): { terrain: number; temperature: number; moisture: number } {
  // Scale coordinates for different layers
  const scale = 0.05;
  return {
    terrain: (noise.terrain(x * scale, y * scale) + 1) / 2,
    temperature: (noise.temperature(x * scale, y * scale) + 1) / 2,
    moisture: (noise.moisture(x * scale, y * scale) + 1) / 2,
  };
}
