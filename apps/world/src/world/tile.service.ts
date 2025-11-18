import { Injectable, Logger } from '@nestjs/common';
import { WorldDatabaseService } from './world-database.service';
import { WorldUtilsService } from './world-utils.service';
import { ChunkData } from './types';
import { ChunkGeneratorService } from './chunk-generator.service';
import type { WorldTile, TileWithNearbyBiomes } from './dto';
import { WORLD_CHUNK_SIZE } from '@mud/constants';

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
    return {
      ...tile,
      nearbyBiomes,
    };
  }

  async getTile(x: number, y: number): Promise<WorldTile | null> {
    await this.ensureSeed();
    // Compute tile deterministically from seed
    return this.chunkGenerator.generateTileAt(x, y, this.currentSeed);
  }

  reconstructChunkFromTiles(tiles: WorldTile[]): ChunkData {
    if (tiles.length === 0) {
      return {
        chunkX: 0,
        chunkY: 0,
        tiles: [],
        stats: {
          biomes: {},
          averageHeight: 0,
          averageTemperature: 0,
          averageMoisture: 0,
        },
      };
    }

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

    const { chunkX, chunkY } = this.worldUtils.getChunkCoordinates(
      tiles[0].x,
      tiles[0].y,
    );

    return {
      chunkX,
      chunkY,
      tiles: tiles,
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
}
