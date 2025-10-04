import { Injectable } from '@nestjs/common';
import { calculateDirection } from '../../shared/direction.util';
import type { NearbySettlement } from '../../world/world.service';
import type {
  Player,
  VisibleSettlement,
  TimingMetrics,
} from './look-view-types';

@Injectable()
export class SettlementService {
  /**
   * Processes visible settlements including current settlement
   */
  processVisibleSettlements(
    player: Player,
    visibilityRadius: number,
    centerWithNearby: {
      nearbySettlements?: NearbySettlement[];
      currentSettlement?: { name: string; type: string; size: string };
    } | null,
    timing: TimingMetrics,
  ): VisibleSettlement[] {
    const tSettlementsStart = Date.now();

    const nearby: NearbySettlement[] =
      (centerWithNearby?.nearbySettlements as NearbySettlement[]) || [];

    let visibleSettlements = nearby
      .filter((s) => s.distance <= visibilityRadius * 1.2 || s.size === 'large')
      .map((s) => ({
        name: s.name,
        type: s.type,
        size: s.size,
        distance: s.distance,
        direction: calculateDirection(player.x, player.y, s.x, s.y),
      }));

    // If we're standing in a settlement, include it explicitly as distance 0 at "here"
    const currentSettlement = centerWithNearby?.currentSettlement;
    if (
      currentSettlement?.name &&
      currentSettlement?.type &&
      currentSettlement?.size
    ) {
      const alreadyIncluded = visibleSettlements.some(
        (s) =>
          s.name === currentSettlement.name &&
          s.type === currentSettlement.type,
      );
      if (!alreadyIncluded) {
        visibleSettlements = [
          {
            name: currentSettlement.name,
            type: currentSettlement.type,
            size: currentSettlement.size,
            distance: 0,
            direction: 'here',
          },
          ...visibleSettlements,
        ];
      }
    }

    timing.tSettlementsFilterMs = Date.now() - tSettlementsStart;
    return visibleSettlements;
  }
}
