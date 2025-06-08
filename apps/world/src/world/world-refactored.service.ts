import { Injectable, Logger } from '@nestjs/common';
import seedrandom from 'seedrandom';
import { ChunkData, SettlementFootprint } from './types';
import { WorldDatabaseService } from './world-database.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { TileService, TileWithNearbyBiomes } from './tile.service';
import { WorldUtilsService } from './world-utils.service';
import { SettlementGenerator } from '../settlement-generator/settlement-generator';
import { Settlement } from '@prisma/client';

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
      this.logger.log(
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
}
