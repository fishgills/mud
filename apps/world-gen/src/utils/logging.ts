// Logging and statistics utility
import { TileInfo } from '../services/chunkService';

export interface ChunkStats {
  tileCount: number;
  biomeCounts: Record<string, number>;
  redisHits: number;
  dbHits: number;
  generated: number;
  durationMs: number;
}

export class ChunkLogger {
  private start: number;
  public stats: ChunkStats;

  constructor() {
    this.start = Date.now();
    this.stats = {
      tileCount: 0,
      biomeCounts: {},
      redisHits: 0,
      dbHits: 0,
      generated: 0,
      durationMs: 0,
    };
  }

  logTile(tile: TileInfo, source: 'redis' | 'db' | 'generated') {
    this.stats.tileCount++;
    this.stats.biomeCounts[tile.biome] =
      (this.stats.biomeCounts[tile.biome] || 0) + 1;
    if (source === 'redis') this.stats.redisHits++;
    else if (source === 'db') this.stats.dbHits++;
    else if (source === 'generated') this.stats.generated++;
  }

  finish() {
    this.stats.durationMs = Date.now() - this.start;
    return this.stats;
  }
}
