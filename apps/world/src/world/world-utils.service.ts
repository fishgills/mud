import { Injectable } from '@nestjs/common';
import { Settlement } from '@mud/database';
import { WORLD_CHUNK_SIZE } from '@mud/shared-constants';
@Injectable()
export class WorldUtilsService {
  /**
   * Calculate the minimum distance required between settlements based on size
   */
  getMinDistanceBetweenSettlements(size: string): number {
    switch (size) {
      case 'large':
        return 20; // Cities need lots of space
      case 'medium':
        return 15; // Towns need moderate space
      case 'small':
        return 10; // Villages need some space
      case 'tiny':
        return 8; // Hamlets/farms need minimal space
      default:
        return 8;
    }
  }

  /**
   * Calculate compass direction from one coordinate to another
   */
  calculateDirection(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): string {
    const dx = toX - fromX;
    const dy = toY - fromY;

    // Calculate angle in radians, then convert to degrees
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Normalize angle to 0-360 range
    const normalizedAngle = (angle + 360) % 360;

    // Convert to compass direction
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'east';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'northeast';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'north';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'northwest';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'west';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'southwest';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'south';
    return 'southeast';
  }

  /**
   * Get chunk coordinates from world coordinates
   */
  getChunkCoordinates(
    x: number,
    y: number,
  ): { chunkX: number; chunkY: number } {
    return {
      chunkX: Math.floor(x / WORLD_CHUNK_SIZE),
      chunkY: Math.floor(y / WORLD_CHUNK_SIZE),
    };
  }

  /**
   * Calculate Euclidean distance between two points
   */
  calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  /**
   * Round a number to specified decimal places
   */
  roundToDecimalPlaces(num: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  /**
   * Check if settlements overlap based on their minimum distance requirements
   */
  checkSettlementOverlap(
    newX: number,
    newY: number,
    newSize: string,
    existingSettlements: Settlement[],
  ): boolean {
    return existingSettlements.some((settlement) => {
      const distance = this.calculateDistance(
        settlement.x,
        settlement.y,
        newX,
        newY,
      );
      const minDistance = Math.max(
        this.getMinDistanceBetweenSettlements(newSize),
        this.getMinDistanceBetweenSettlements(settlement.size),
      );
      return distance < minDistance;
    });
  }
}
