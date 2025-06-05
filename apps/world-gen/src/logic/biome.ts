// Biome logic: defines biome types and how to determine them from noise values

export type Biome =
  | 'ocean'
  | 'lake'
  | 'beach'
  | 'plains'
  | 'forest'
  | 'jungle'
  | 'mountain'
  | 'tundra'
  | 'desert'
  | 'swamp'
  | 'city'
  | 'village'
  | 'hamlet'
  | 'farm';

export interface TileNoise {
  terrain: number;
  temperature: number;
  moisture: number;
}

export function getBiome(noise: TileNoise): Biome {
  const { terrain, temperature, moisture } = noise;
  if (terrain < 0.2) return 'ocean';
  if (terrain < 0.25) return 'lake';
  if (terrain < 0.3) return 'beach';
  if (terrain > 0.8) return 'mountain';
  if (temperature < 0.2) {
    if (terrain > 0.6) return 'tundra';
    return 'tundra';
  }
  if (temperature > 0.8 && moisture > 0.7) return 'jungle';
  if (moisture < 0.2) return 'desert';
  if (moisture > 0.8) return 'swamp';
  if (moisture > 0.5) return 'forest';
  return 'plains';
}
