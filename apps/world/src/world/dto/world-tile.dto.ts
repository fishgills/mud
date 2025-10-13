import type { Biome } from './biome.dto';

export interface WorldTile {
  id: number;
  x: number;
  y: number;
  biomeId: number;
  biomeName: string;
  description?: string | null;
  height: number;
  temperature: number;
  moisture: number;
  seed: number;
  chunkX: number;
  chunkY: number;
  createdAt: Date;
  updatedAt: Date;
  biome?: Biome | null;
}
