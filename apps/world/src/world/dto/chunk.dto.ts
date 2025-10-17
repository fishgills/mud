import type { WorldTile } from './world-tile.dto';
import type { Settlement } from './settlement.dto';

export interface ChunkStats {
  averageHeight: number;
  averageTemperature: number;
  averageMoisture: number;
  biomes?: Record<string, number>;
}

export interface BiomeCount {
  biomeName: string;
  count: number;
}

export interface PaginatedTiles {
  tiles: WorldTile[];
  totalCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface ChunkData {
  chunkX: number;
  chunkY: number;
  tiles?: WorldTile[];
  paginatedTiles?: PaginatedTiles;
  settlements?: Settlement[];
  stats?: ChunkStats;
  biomeStats?: BiomeCount[];
}
