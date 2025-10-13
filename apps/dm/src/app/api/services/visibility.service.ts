import { Injectable } from '@nestjs/common';
import { WorldService } from '../../world/world.service';
import type { Player, TimingMetrics, CenterTile } from './look-view-types';
import type { WorldTile } from '../../world/world.service';

@Injectable()
export class VisibilityService {
  constructor(private worldService: WorldService) {}

  /**
   * Calculates visibility radius based on tile height
   */
  calculateVisibilityRadius(centerTile: Pick<CenterTile, 'height'>): number {
    const base = 10;
    const heightFactor = Math.max(0, Math.min(1, centerTile.height));
    const visibilityRadius = Math.round(base + heightFactor * 7);
    return Math.max(3, Math.min(12, visibilityRadius));
  }

  /**
   * Fetches and processes tile data within visibility bounds
   */
  async processTileData(
    player: Player,
    visibilityRadius: number,
    timing: TimingMetrics,
    prefetch?: {
      extTilesPromise?: Promise<WorldTile[]>;
      tExtStart?: number;
    },
  ): Promise<{
    tiles: WorldTile[];
    extTiles: WorldTile[];
  }> {
    // Only fetch the area we actually need (ceil to cover full radius)
    const r = Math.ceil(Math.max(3, Math.min(12, visibilityRadius)));
    const minXMax = player.x - r;
    const maxXMax = player.x + r;
    const minYMax = player.y - r;
    const maxYMax = player.y + r;

    // Scan a wider ring for peaks, but scale with visibility to reduce work on low terrain
    // Defaults: base 14, scale factor 1.5x visibility, capped at 30
    const peakScanRadiusMax = Math.min(
      30,
      Math.max(14, Math.round(visibilityRadius * 1.5)),
    );
    // Either await a prefetched extTiles promise (started earlier for concurrency)
    // or fetch here as before.
    const tExtBoundsStart = prefetch?.tExtStart ?? Date.now();
    const extTiles = await (
      prefetch?.extTilesPromise
        ? prefetch.extTilesPromise
        : this.worldService.getTilesInBounds(
            player.x - peakScanRadiusMax,
            player.x + peakScanRadiusMax,
            player.y - peakScanRadiusMax,
            player.y + peakScanRadiusMax,
          )
    ).then((res) => {
      timing.tExtBoundsMs = Date.now() - tExtBoundsStart;
      return res;
    });
    // Reuse the extended fetch result for visible tile list;
    // record tBoundsTilesMs equal to the ext fetch time to reflect shared work
    const boundTiles = extTiles.filter(
      (t) =>
        t.x >= minXMax && t.x <= maxXMax && t.y >= minYMax && t.y <= maxYMax,
    );
    timing.tBoundsTilesMs = timing.tExtBoundsMs;

    const tFilterTilesStart = Date.now();
    const tiles = boundTiles.filter(
      (t) =>
        Math.sqrt((t.x - player.x) ** 2 + (t.y - player.y) ** 2) <=
        visibilityRadius,
    );
    timing.tFilterTilesMs = Date.now() - tFilterTilesStart;
    timing.tilesCount = tiles.length;

    return { tiles, extTiles };
  }
}
