import type { WorldTile } from './world-tile.dto';

export interface Biome {
  id: number;
  name: string;
  tiles?: WorldTile[];
}
