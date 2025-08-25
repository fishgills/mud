import { Injectable, Logger } from '@nestjs/common';
import { WorldDatabaseService } from './world-database.service';
import { WorldUtilsService } from './world-utils.service';
import { ChunkData } from './types';
import { ChunkGeneratorService } from './chunk-generator.service';
import { SettlementGenerator } from '../settlement-generator/settlement-generator';
import { WorldTile } from './models';

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
    private chunkGenerator: ChunkGeneratorService,
  ) {}

  private currentSeed = 0;
  private async ensureSeed(): Promise<void> {
    if (this.currentSeed) return;
    this.currentSeed = await this.worldDatabase.loadWorldSeed();
  }

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
    await this.ensureSeed();
    // Compute tile deterministically from seed
    return this.chunkGenerator.generateTileAt(x, y, this.currentSeed);
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

  async findNearbyBiomes(
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

  async analyzeSettlements(x: number, y: number) {
    const radius = 50;
    const settlements = await this.worldDatabase.getSettlementsInRadius(
      x,
      y,
      radius,
    );

    // Check if the current tile is part of any settlement footprint
    let currentSettlement: TileWithNearbyBiomes['currentSettlement'];
    let currentSettlementId: number | undefined;

    // Ensure we have the world seed for deterministic footprints
    await this.ensureSeed();
    const generator = new SettlementGenerator(this.currentSeed);

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

      // Deterministic footprint membership check (irregular blob)
      try {
        const footprint = generator.generateSettlementFootprint(
          settlement.x,
          settlement.y,
          settlement.size as 'large' | 'medium' | 'small' | 'tiny',
          () => 0.5, // rng not used by generator's deterministic shape logic
          {
            type: settlement.type as any,
            population: settlement.population as any,
          },
        );

        const tile = footprint.tiles.find((t) => t.x === x && t.y === y);
        if (tile) {
          currentSettlement = {
            name: settlement.name,
            type: settlement.type,
            size: settlement.size,
            intensity: tile.intensity,
            isCenter: false,
          };
          currentSettlementId = settlement.id;
          break;
        }
      } catch (e) {
        this.logger.debug(
          `Footprint check failed for settlement ${settlement.name} (${settlement.x},${settlement.y}): ${e instanceof Error ? e.message : e}`,
        );
      }
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
