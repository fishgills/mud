import { Injectable } from '@nestjs/common';
import { calculateDirection } from '../../shared/direction.util';
import type { Player, BiomeSummary, TimingMetrics } from './look-view-types';
import type { WorldTile } from '../../../generated/world-graphql';

@Injectable()
export class BiomeService {
  /**
   * Generates biome summary with directional information
   */
  generateBiomeSummary(
    player: Player,
    tiles: WorldTile[],
    timing: TimingMetrics,
  ): BiomeSummary[] {
    const tBiomeStart = Date.now();

    const biomeCounts = new Map<string, number>();
    const biomeDirBuckets = new Map<string, Record<string, number>>();

    for (const t of tiles) {
      biomeCounts.set(t.biomeName, (biomeCounts.get(t.biomeName) || 0) + 1);
      const dir = calculateDirection(player.x, player.y, t.x, t.y);
      const bucket = biomeDirBuckets.get(t.biomeName) || {};
      bucket[dir] = (bucket[dir] || 0) + 1;
      biomeDirBuckets.set(t.biomeName, bucket);
    }

    const totalTiles = tiles.length || 1;
    const biomeSummary = Array.from(biomeCounts.entries())
      .map(([biomeName, count]) => {
        const dirs = biomeDirBuckets.get(biomeName) || {};
        const sortedDirs = Object.entries(dirs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([d]) => d);
        return {
          biomeName,
          proportion: count / totalTiles,
          predominantDirections: sortedDirs,
        };
      })
      .sort((a, b) => b.proportion - a.proportion)
      .slice(0, 6);

    timing.tBiomeSummaryMs = Date.now() - tBiomeStart;
    return biomeSummary;
  }
}
