import { Injectable } from '@nestjs/common';
import { calculateDirection } from '../../shared/direction.util';
import type { Player, VisiblePeak, TimingMetrics } from './look-view-types';
import type { WorldTile } from '../../../generated/world-graphql';

@Injectable()
export class PeakService {
  /**
   * Identifies and processes visible peaks
   */
  processVisiblePeaks(
    player: Player,
    visibilityRadius: number,
    extTiles: WorldTile[],
    timing: TimingMetrics,
  ): VisiblePeak[] {
    const minPeakDistance = Math.max(3, Math.floor(visibilityRadius / 2));
    const tPeaksSortStart = Date.now();

    const peakCandidates = extTiles
      .filter(
        (t) =>
          Math.sqrt((t.x - player.x) ** 2 + (t.y - player.y) ** 2) >=
            minPeakDistance && t.height >= 0.7,
      )
      .sort((a, b) => b.height - a.height)
      .slice(0, 6);

    timing.tPeaksSortMs = Date.now() - tPeaksSortStart;
    timing.peaksCount = peakCandidates.length;

    return peakCandidates.map((t) => {
      const dx = t.x - player.x;
      const dy = t.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const direction = calculateDirection(player.x, player.y, t.x, t.y);
      return { x: t.x, y: t.y, height: t.height, distance, direction };
    });
  }
}
