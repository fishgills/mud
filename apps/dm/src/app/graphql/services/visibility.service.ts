import { Injectable } from '@nestjs/common';
import { WorldService } from '../../world/world.service';
import type { Player, TimingMetrics } from './look-view-types';

@Injectable()
export class VisibilityService {
  constructor(private worldService: WorldService) {}

  /**
   * Calculates visibility radius based on tile height
   */
  calculateVisibilityRadius(centerTile: any): number {
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
  ): Promise<{ tiles: any[]; extTiles: any[] }> {
    const maxVisibilityRadius = 12;
    const minXMax = player.x - maxVisibilityRadius;
    const maxXMax = player.x + maxVisibilityRadius;
    const minYMax = player.y - maxVisibilityRadius;
    const maxYMax = player.y + maxVisibilityRadius;

    const tBoundsStart = Date.now();
    const boundsPromise = this.worldService
      .getTilesInBounds(minXMax, maxXMax, minYMax, maxYMax)
      .then((res) => {
        timing.tBoundsTilesMs = Date.now() - tBoundsStart;
        return res;
      });

    const peakScanRadiusMax = 30;
    const tExtBoundsStart = Date.now();
    const extPromise = this.worldService
      .getTilesInBounds(
        player.x - peakScanRadiusMax,
        player.x + peakScanRadiusMax,
        player.y - peakScanRadiusMax,
        player.y + peakScanRadiusMax,
      )
      .then((res) => {
        timing.tExtBoundsMs = Date.now() - tExtBoundsStart;
        return res;
      });

    const [boundTiles, extTiles] = await Promise.all([
      boundsPromise,
      extPromise,
    ]);

    const tFilterTilesStart = Date.now();
    const tiles = boundTiles
      .map((t) => ({
        x: t.x,
        y: t.y,
        biomeName: t.biomeName,
        height: t.height,
      }))
      .filter(
        (t) =>
          Math.sqrt((t.x - player.x) ** 2 + (t.y - player.y) ** 2) <=
          visibilityRadius,
      );
    timing.tFilterTilesMs = Date.now() - tFilterTilesStart;
    timing.tilesCount = tiles.length;

    return { tiles, extTiles };
  }
}
