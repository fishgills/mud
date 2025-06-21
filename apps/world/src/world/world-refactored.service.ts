import { Injectable, Logger } from '@nestjs/common';
import seedrandom from 'seedrandom';
import { ChunkData, SettlementFootprint } from './types';
import { WorldDatabaseService } from './world-database.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { TileService, TileWithNearbyBiomes } from './tile.service';
import { WorldUtilsService } from './world-utils.service';
import { SettlementGenerator } from '../settlement-generator/settlement-generator';
import { Settlement, WorldTile } from '@mud/database';

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
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.worldDatabase.initializeBiomes();
      this.currentSeed = await this.worldDatabase.loadWorldSeed();
    } catch (error) {
      this.logger.error('Failed to initialize WorldService:', error);
    }
  }

  async getChunk(chunkX: number, chunkY: number): Promise<ChunkData> {
    const startTime = Date.now();

    try {
      // Check database for existing tiles
      const existingTiles = await this.worldDatabase.getChunkFromDatabase(
        chunkX,
        chunkY,
      );

      if (existingTiles.length === 2500) {
        // 50x50 = 2500
        const chunkData =
          this.tileService.reconstructChunkFromTiles(existingTiles);
        this.logger.debug(
          `Loaded existing chunk ${chunkX},${chunkY} from database.`,
        );
        return chunkData;
      }

      // Generate new chunk
      const chunkData = this.chunkGenerator.generateChunk(
        chunkX,
        chunkY,
        this.currentSeed,
      );

      // Store in database
      await this.worldDatabase.saveChunkToDatabase(chunkData, this.currentSeed);

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
    // First ensure the tile exists by generating its chunk if needed
    let tile = await this.tileService.getTile(x, y);

    if (!tile) {
      // Generate the chunk containing this tile
      const { chunkX, chunkY } = this.worldUtils.getChunkCoordinates(x, y);
      await this.getChunk(chunkX, chunkY);

      // Try to get the tile again
      tile = await this.tileService.getTile(x, y);
      if (!tile) {
        throw new Error(`Failed to generate tile at ${x},${y}`);
      }
    }

    return await this.tileService.getTileWithNearbyBiomes(x, y);
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
    );
  }

  async updateTileDescription(
    x: number,
    y: number,
    description: string,
  ): Promise<boolean | null> {
    try {
      const updatedTile = await this.worldDatabase.updateTileDescription(
        x,
        y,
        description,
      );

      if (!updatedTile) {
        this.logger.warn(`Tile not found at coordinates (${x}, ${y})`);
        return null;
      }

      // Return the updated tile with nearby biomes info
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update tile description at (${x}, ${y}):`,
        error,
      );
      throw error;
    }
  }

  // GraphQL-friendly methods for field resolution
  async getChunkTiles(
    chunkX: number,
    chunkY: number,
    limit?: number,
    offset?: number,
  ): Promise<WorldTile[]> {
    // Check database for existing tiles first
    const existingTiles = await this.worldDatabase.getChunkFromDatabase(
      chunkX,
      chunkY,
      limit,
      offset,
    );

    // If we have pagination parameters, return the paginated results directly
    if (limit !== undefined || offset !== undefined) {
      // Ensure chunk exists first
      await this.ensureChunkExists(chunkX, chunkY);

      // Return paginated results
      return await this.worldDatabase.getChunkFromDatabase(
        chunkX,
        chunkY,
        limit,
        offset,
      );
    }

    // Legacy behavior: check for full chunk and generate if needed
    const totalTiles = await this.worldDatabase.getChunkTileCount(
      chunkX,
      chunkY,
    );

    if (totalTiles === 2500) {
      this.logger.debug(
        `Loaded existing chunk ${chunkX},${chunkY} from database.`,
      );
      return existingTiles;
    }

    // Generate chunk if not found
    await this.getChunk(chunkX, chunkY);

    // Re-fetch tiles from database to get the proper IDs
    return await this.worldDatabase.getChunkFromDatabase(chunkX, chunkY);
  }

  async getChunkTileCount(chunkX: number, chunkY: number): Promise<number> {
    // Ensure chunk exists first
    await this.ensureChunkExists(chunkX, chunkY);

    return await this.worldDatabase.getChunkTileCount(chunkX, chunkY);
  }

  async getChunkSettlements(
    chunkX: number,
    chunkY: number,
  ): Promise<Settlement[]> {
    // Generate chunk if needed
    await this.ensureChunkExists(chunkX, chunkY);

    // Get settlements in the chunk bounds
    const chunkSize = 50; // Assuming 50x50 chunks
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

  private async ensureChunkExists(
    chunkX: number,
    chunkY: number,
  ): Promise<void> {
    const tileCount = await this.worldDatabase.getChunkTileCount(
      chunkX,
      chunkY,
    );

    if (tileCount < 2500) {
      await this.getChunk(chunkX, chunkY);
    }
  }
}
