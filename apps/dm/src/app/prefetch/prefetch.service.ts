import { Injectable, Logger } from '@nestjs/common';
import {
  EventBus,
  type PlayerMoveEvent,
  type PlayerSpawnEvent,
  type PlayerRespawnEvent,
} from '@mud/engine';
import { WorldService } from '../world/world.service';

/**
 * PrefetchService
 * Listens to engine events and pre-warms DM-side world data caches that are
 * used by getLookView: center tile + nearby metadata and surrounding chunks.
 */
@Injectable()
export class PrefetchService {
  private readonly logger = new Logger(PrefetchService.name);

  // Conservative upper bound for the look "extended" scan used for peaks.
  // Visibility radius in DM is clamped to [3,12]; we scan ~1.5x that for peaks.
  private static readonly PEAK_SCAN_RADIUS_UPPER_BOUND = 18; // ~1.5 * 12

  constructor(private readonly world: WorldService) {
    // Subscribe to relevant events. These handlers are fire-and-forget and
    // never block the main event path.
    EventBus.on('player:move', (e) => this.onPlayerMove(e as PlayerMoveEvent));
    EventBus.on('player:spawn', (e) =>
      this.onPlayerSpawn(e as PlayerSpawnEvent),
    );
    EventBus.on('player:respawn', (e) =>
      this.onPlayerRespawn(e as PlayerRespawnEvent),
    );

    this.logger.log('PrefetchService initialized and listening for events');
  }

  private async onPlayerMove(event: PlayerMoveEvent): Promise<void> {
    // Prefetch around the destination where the next look is most likely.
    void this.prefetchAt(event.toX, event.toY, 'player:move');
  }

  private async onPlayerSpawn(event: PlayerSpawnEvent): Promise<void> {
    void this.prefetchAt(event.x, event.y, 'player:spawn');
  }

  private async onPlayerRespawn(event: PlayerRespawnEvent): Promise<void> {
    void this.prefetchAt(event.x, event.y, 'player:respawn');
  }

  private async prefetchAt(
    x: number,
    y: number,
    reason: string,
  ): Promise<void> {
    try {
      const t0 = Date.now();
      // 1) Center tile + nearby biomes/settlements/currentSettlement
      const centerPromise = this.world
        .getTileInfoWithNearby(x, y)
        .catch(() => null);

      // 2) Extended tiles area to warm chunk cache for peaks/biome computations
      const r = PrefetchService.PEAK_SCAN_RADIUS_UPPER_BOUND;
      const extPromise = this.world
        .getTilesInBounds(x - r, x + r, y - r, y + r)
        .catch(() => []);

      const [center, ext] = await Promise.all([centerPromise, extPromise]);
      const totalMs = Date.now() - t0;

      // Lightweight debug log; avoid spamming
      this.logger.debug(
        `Prefetched @(${x},${y}) reason=${reason} center=${center ? 'ok' : 'err'} extTiles=${ext.length} in ${totalMs}ms`,
      );
    } catch (e) {
      // Never throw from prefetch; just log
      this.logger.debug(
        `Prefetch failed @(${x},${y}) reason=${reason}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
