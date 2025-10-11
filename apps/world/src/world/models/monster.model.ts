import type { Biome } from './biome.model';
import type { WorldTile } from './world-tile.model';

export interface Monster {
  id: number;
  name: string;
  type: string;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  x: number;
  y: number;
  isAlive: boolean;
  lastMove: Date;
  spawnedAt: Date;
  biomeId: number;
  worldTileId?: number | null;
  createdAt: Date;
  updatedAt: Date;
  biome?: Biome;
  worldTile?: WorldTile;
}
