import { Injectable, Logger } from '@nestjs/common';
import seedrandom from 'seedrandom';
import { ChunkData, SettlementFootprint } from './types';
import { WorldDatabaseService } from './world-database.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { TileService, TileWithNearbyBiomes } from './tile.service';
import { WorldUtilsService } from './world-utils.service';
import { SettlementGenerator } from '../settlement-generator/settlement-generator';
import { Settlement } from '@mud/database';
import { WorldTile } from './models';
import { WORLD_CHUNK_SIZE } from '@mud/constants';

@Injectable()
export class WorldService {
  private readonly logger = new Logger(WorldService.name);
  private currentSeed = 0;

  constructor(
    private worldDatabase: WorldDatabaseService,
    private chunkGenerator: ChunkGeneratorService,
    private tileService: TileService,
    private worldUtils: WorldUtilsService,
  ) {
    this.logger.log('WorldService initialized');
    void this.initialize();
    console.log('hi'); // hi
  }

  private async initialize(): Promise<void> {
    try {
      await this.worldDatabase.initializeBiomes();
      this.currentSeed = await this.worldDatabase.loadWorldSeed();
    } catch (error) {
      this.logger.error('Failed to initialize WorldService:', error);
    }
  }

  /** Returns the active world seed used for terrain generation. */
  getCurrentSeed(): number {
    return this.currentSeed;
  }

  async getChunk(chunkX: number, chunkY: number): Promise<ChunkData> {
    const startTime = Date.now();

    try {
      // Compute chunk deterministically from seed (no DB tile read)
      const chunkData = this.chunkGenerator.generateChunk(
        chunkX,
        chunkY,
        this.currentSeed,
      );
      // Persist only settlements if desired; tiles are not stored
      if (chunkData.settlements?.length) {
        await this.worldDatabase.saveChunkSettlements(chunkData.settlements);
      }

      const generationTime = Date.now() - startTime;
      this.logger.debug(
        `Generated chunk ${chunkX},${chunkY} in ${generationTime}ms. Biomes: ${Object.keys(
          chunkData.stats.biomes,
        ).join(', ')}`,
      );

      return chunkData;
    } catch (error) {
      this.logger.error(`Error getting chunk ${chunkX},${chunkY}:`, error);
      throw error;
    }
  }

  async getTileWithNearbyBiomes(
    x: number,
    y: number,
  ): Promise<TileWithNearbyBiomes> {
    // Compute the center tile on-the-fly
    const center = this.chunkGenerator.generateTileAt(x, y, this.currentSeed);
    // Compute nearby biome summary using compute-first tile access
    const nearbyBiomes = await this.tileService.findNearbyBiomes(
      x,
      y,
      center.biomeName,
    );
    // Fetch nearby settlements from DB
    const { nearbySettlements, currentSettlement } =
      await this.tileService.analyzeSettlements(x, y);

    return {
      ...center,
      nearbyBiomes,
      nearbySettlements,
      currentSettlement,
    };
  }

  // Helper method to allow TileService to generate chunks
  async generateMissingChunk(chunkX: number, chunkY: number): Promise<void> {
    await this.getChunk(chunkX, chunkY);
  }

  getMinDistanceBetweenSettlements(size: string): number {
    return this.worldUtils.getMinDistanceBetweenSettlements(size);
  }

  isCoordinateInSettlement(
    x: number,
    y: number,
    settlements: Array<Settlement>,
  ): { isSettlement: boolean; settlement?: Settlement; intensity: number } {
    for (const settlement of settlements) {
      const footprint = this.regenerateSettlementFootprint(settlement);
      const tile = footprint.tiles.find((t) => t.x === x && t.y === y);

      if (tile) {
        return {
          isSettlement: true,
          settlement: settlement,
          intensity: tile.intensity,
        };
      }
    }

    return { isSettlement: false, intensity: 0 };
  }

  private regenerateSettlementFootprint(settlement: {
    x: number;
    y: number;
    size: string;
    type?: string;
    population?: number;
  }): SettlementFootprint {
    // Create a deterministic random generator based on settlement position
    const coordSeed = settlement.x * 1000 + settlement.y + this.currentSeed;
    const coordRng = seedrandom(coordSeed.toString());

    const settlementGenerator = new SettlementGenerator(this.currentSeed);
    return settlementGenerator.generateSettlementFootprint(
      settlement.x,
      settlement.y,
      settlement.size as 'large' | 'medium' | 'small' | 'tiny',
      coordRng,
      {
        type: settlement.type as any,
        population: settlement.population as any,
      },
    );
  }

  // GraphQL-friendly methods for field resolution
  async getChunkTiles(
    chunkX: number,
    chunkY: number,
    limit?: number,
    offset?: number,
  ): Promise<WorldTile[]> {
    // Always compute tiles on-the-fly
    const chunk = await this.getChunk(chunkX, chunkY);
    // Apply pagination in-memory if requested
    if (limit !== undefined || offset !== undefined) {
      const start = offset ?? 0;
      const end = limit !== undefined ? start + limit : undefined;
      return chunk.tiles.slice(start, end);
    }
    return chunk.tiles;
  }

  async getChunkTileCount(chunkX: number, chunkY: number): Promise<number> {
    // Parameters are part of GraphQL signature but unused in compute-only mode
    void chunkX;
    void chunkY;
    // Compute-only mode: chunk size is fixed
    return 50 * 50;
  }

  async getChunkSettlements(
    chunkX: number,
    chunkY: number,
  ): Promise<Settlement[]> {
    // Get settlements in the chunk bounds
    const chunkSize = WORLD_CHUNK_SIZE;
    const startX = chunkX * chunkSize;
    const startY = chunkY * chunkSize;
    const endX = startX + chunkSize - 1;
    const endY = startY + chunkSize - 1;

    // Get settlements within chunk bounds
    return await this.worldDatabase.getSettlementsInBounds(
      startX,
      startY,
      endX,
      endY,
    );
  }

  async getChunkStats(
    chunkX: number,
    chunkY: number,
  ): Promise<{
    averageHeight: number;
    averageTemperature: number;
    averageMoisture: number;
  }> {
    const tiles = await this.getChunkTiles(chunkX, chunkY);

    let totalHeight = 0;
    let totalTemperature = 0;
    let totalMoisture = 0;

    for (const tile of tiles) {
      totalHeight += tile.height;
      totalTemperature += tile.temperature;
      totalMoisture += tile.moisture;
    }

    const count = tiles.length;
    return {
      averageHeight: totalHeight / count,
      averageTemperature: totalTemperature / count,
      averageMoisture: totalMoisture / count,
    };
  }

  async getChunkBiomeStats(
    chunkX: number,
    chunkY: number,
  ): Promise<
    Array<{
      biomeName: string;
      count: number;
    }>
  > {
    const tiles = await this.getChunkTiles(chunkX, chunkY);

    const biomeCount: Record<string, number> = {};

    for (const tile of tiles) {
      if (tile.biomeName) {
        biomeCount[tile.biomeName] = (biomeCount[tile.biomeName] || 0) + 1;
      }
    }

    return Object.entries(biomeCount).map(([biomeName, count]) => ({
      biomeName,
      count,
    }));
  }
}
