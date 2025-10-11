import type { WorldTile } from './world-tile.model';

export interface Biome {
  id: number;
  name: string;
  tiles?: WorldTile[];
}
