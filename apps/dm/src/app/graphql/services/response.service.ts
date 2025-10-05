import { Injectable } from '@nestjs/common';
import type {
  CenterTile,
  BiomeSummary,
  VisiblePeak,
  VisibleSettlement,
} from './look-view-types';
import { LookViewData, NearbyPlayerInfo } from '../types/response.types';
import type { Settlement } from '../../world/world.service';
import { Monster } from '@mud/database';

@Injectable()
export class ResponseService {
  /**
   * Builds the final response data structure
   */
  buildResponseData(
    centerTile: CenterTile,
    visibilityRadius: number,
    biomeSummary: BiomeSummary[],
    visiblePeaks: VisiblePeak[],
    visibleSettlements: VisibleSettlement[],
    currentSettlement: Settlement | null,
    description: string,
    nearbyPlayers: NearbyPlayerInfo[],
    monsters: Monster[],
  ): LookViewData {
    return {
      location: {
        x: centerTile.x,
        y: centerTile.y,
        biomeName: centerTile.biomeName,
        description: centerTile.description || '',
        height: centerTile.height,
        temperature: centerTile.temperature,
        moisture: centerTile.moisture,
      },
      nearbyPlayers,
      visibilityRadius,
      biomeSummary,
      visiblePeaks,
      visibleSettlements,
      monsters,
      currentSettlement: currentSettlement
        ? {
            name: currentSettlement.name,
            type: currentSettlement.type,
            size: currentSettlement.size,
            intensity: currentSettlement.intensity,
            isCenter: Boolean(currentSettlement.isCenter),
          }
        : undefined,
      inSettlement: Boolean(
        currentSettlement && currentSettlement.intensity > 0,
      ),
      description,
    };
  }
}
