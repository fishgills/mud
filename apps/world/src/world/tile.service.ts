import { Injectable, Logger } from '@nestjs/common';
import { WorldDatabaseService } from './world-database.service';
import { WorldUtilsService } from './world-utils.service';
import { WorldTile } from '@prisma/client';
import { ChunkData } from './types';

export interface TileWithNearbyBiomes extends WorldTile {
  nearbyBiomes: Array<{
    biomeName: string;
    distance: number;
    direction: string;
  }>;
  nearbySettlements: Array<{
    name: string;
    type: string;
    size: string;
    population: number;
    x: number;
    y: number;
    description: string;
    distance: number;
  }>;
  currentSettlement?: {
    name: string;
    type: string;
    size: string;
    intensity: number;
    isCenter: boolean;
  };
}

@Injectable()
export class TileService {
  private readonly logger = new Logger(TileService.name);

  constructor(
    private worldDatabase: WorldDatabaseService,
    private worldUtils: WorldUtilsService,
  ) {}

  async getTileWithNearbyBiomes(
    x: number,
    y: number,
  ): Promise<TileWithNearbyBiomes> {
    const tile = await this.getTile(x, y);
    if (!tile) {
      throw new Error(`Tile not found at ${x},${y}`);
    }

    const nearbyBiomes = await this.findNearbyBiomes(x, y, tile.biomeName);
    const { nearbySettlements, currentSettlement } =
      await this.analyzeSettlements(x, y);

    return {
      ...tile,
      nearbyBiomes,
      nearbySettlements,
      currentSettlement,
    };
  }

  async getTile(
    x: number,
    y: number,
    retryCount = 0,
  ): Promise<WorldTile | null> {
    // Prevent infinite recursion
    if (retryCount > 2) {
      this.logger.error(`Max retries reached for tile ${x},${y}`);
      return null;
    }

    // Check database first
    const dbTile = await this.worldDatabase.getTileFromDatabase(x, y);
    if (dbTile) {
      return dbTile;
    }

    // If tile not found, return null - chunk generation should be handled elsewhere
    return null;
  }

  reconstructChunkFromTiles(tiles: WorldTile[]): ChunkData {
    const biomeCount: Record<string, number> = {};
    let totalHeight = 0;
    let totalTemperature = 0;
    let totalMoisture = 0;

    tiles.forEach((tile) => {
      biomeCount[tile.biomeName] = (biomeCount[tile.biomeName] || 0) + 1;
      totalHeight += tile.height;
      totalTemperature += tile.temperature;
      totalMoisture += tile.moisture;
    });

    return {
      tiles: tiles,
      settlements: [], // Would need to fetch from Settlement table
      stats: {
        biomes: biomeCount,
        averageHeight: totalHeight / tiles.length,
        averageTemperature: totalTemperature / tiles.length,
        averageMoisture: totalMoisture / tiles.length,
      },
    };
  }

  private async findNearbyBiomes(
    x: number,
    y: number,
    currentBiome: string,
  ): Promise<
    Array<{ biomeName: string; distance: number; direction: string }>
  > {
    const nearbyBiomes: Array<{
      biomeName: string;
      distance: number;
      direction: string;
    }> = [];
    const seenBiomes = new Set([currentBiome]);

    // Check in expanding radius - reduced from 10 to 5 to prevent too many recursive calls
    for (let radius = 1; radius <= 5 && nearbyBiomes.length < 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // Only check perimeter

          try {
            const nearbyTile = await this.getTile(x + dx, y + dy);
            if (nearbyTile && !seenBiomes.has(nearbyTile.biomeName)) {
              seenBiomes.add(nearbyTile.biomeName);

              const distance = this.worldUtils.calculateDistance(0, 0, dx, dy);
              const direction = this.worldUtils.calculateDirection(
                0,
                0,
                dx,
                dy,
              );

              nearbyBiomes.push({
                biomeName: nearbyTile.biomeName,
                distance: this.worldUtils.roundToDecimalPlaces(distance, 1),
                direction,
              });

              if (nearbyBiomes.length >= 5) break;
            }
          } catch (error) {
            this.logger.debug(
              `Failed to get nearby tile at ${x + dx},${y + dy}:`,
              error,
            );
          }
        }
        if (nearbyBiomes.length >= 5) break;
      }
    }

    return nearbyBiomes.slice(0, 5);
  }

  private async analyzeSettlements(x: number, y: number) {
    const radius = 50;
    const settlements = await this.worldDatabase.getSettlementsInRadius(
      x,
      y,
      radius,
    );

    // Check if the current tile is part of any settlement footprint
    let currentSettlement: TileWithNearbyBiomes['currentSettlement'];
    let currentSettlementId: number | undefined;

    for (const settlement of settlements) {
      // Check if this is the settlement center
      if (settlement.x === x && settlement.y === y) {
        currentSettlement = {
          name: settlement.name,
          type: settlement.type,
          size: settlement.size,
          intensity: 1.0,
          isCenter: true,
        };
        currentSettlementId = settlement.id;
        break;
      }

      // TODO: Add settlement footprint checking logic here
      // This would require the settlement footprint generation logic
    }

    // Calculate distance for each settlement and filter by true radius
    const nearbySettlements = settlements
      .filter((s) => s.id !== currentSettlementId)
      .map((s) => ({
        ...s,
        distance: this.worldUtils.calculateDistance(s.x, s.y, x, y),
      }))
      .filter((s) => s.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .map((s) => ({
        name: s.name,
        type: s.type,
        size: s.size,
        population: s.population,
        x: s.x,
        y: s.y,
        description: s.description,
        distance: this.worldUtils.roundToDecimalPlaces(s.distance, 1),
      }));

    return { nearbySettlements, currentSettlement };
  }
}
