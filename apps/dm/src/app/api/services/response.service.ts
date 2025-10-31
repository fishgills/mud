import { Injectable } from '@nestjs/common';
import type {
  CenterTile,
  BiomeSummary,
  VisiblePeak,
  VisibleSettlement,
} from './look-view-types';
import type { LookViewData, NearbyPlayerInfo } from '../dto/responses.dto';
import type { Settlement } from '../../world/world.service';
import type { Monster } from '../dto/monster.dto';

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
    items?: Array<{
      id: number;
      itemId: number;
      quantity?: number;
      quality?: string | null;
      itemName?: string | null;
      x?: number;
      y?: number;
    }>,
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
      items,
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
