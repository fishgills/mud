import { Injectable } from '@nestjs/common';
import type {
  CenterTile,
  BiomeSummary,
  VisiblePeak,
  VisibleSettlement,
} from './look-view-types';
import { LookViewData, NearbyPlayerInfo } from '../types/response.types';

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
    currentSettlement: any,
    description: string,
    nearbyPlayers: NearbyPlayerInfo[],
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
      currentSettlement: currentSettlement
        ? {
            name: currentSettlement.name,
            type: currentSettlement.type,
            size: currentSettlement.size,
            intensity: currentSettlement.intensity,
            isCenter: currentSettlement.isCenter,
          }
        : undefined,
      inSettlement: Boolean(
        currentSettlement && currentSettlement.intensity > 0,
      ),
      description,
    };
  }
}
