import { Injectable, Logger, Inject } from '@nestjs/common';

import seedrandom from 'seedrandom';
import {
  DEFAULT_WORLD_CONFIG,
  SettlementFootprint,
  TileData,
  WorldSeedConfig,
} from './types';
import { BIOMES } from '../constants';
import { NoiseGenerator } from '../noise-generator/noise-generator';
import { SettlementGenerator } from '../settlement-generator/settlement-generator';
import { BiomeGenerator } from '../biome-generator/biome-generator';
import { PrismaService } from '../prisma/prisma.service';

interface CachedTile {
  x: number;
  y: number;
  biomeId: number;
  biomeName: string;
  description: string;
  height: number;
  temperature: number;
  moisture: number;
  seed: number;
  chunkX: number;
  chunkY: number;
}

export interface TileWithNearbyBiomes extends CachedTile {
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
  settlement?: {
    name: string;
    type: string;
    size: string;
    intensity: number;
    isCenter: boolean;
  };
}

interface SettlementData {
  name: string;
  type: string;
  size: string;
  population: number;
  x: number;
  y: number;
  description: string;
}

export interface ChunkData {
  tiles: TileData[];
  settlements: Array<SettlementData>;
  stats: {
    biomes: Record<string, number>;
    averageHeight: number;
    averageTemperature: number;
    averageMoisture: number;
  };
}

@Injectable()
export class WorldService {
  private readonly logger = new Logger(WorldService.name);

  private currentSeed = 0;
  constructor(@Inject(PrismaService) private prismaService: PrismaService) {
    this.logger.log('WorldService initialized');
    this.initializeBiomes().catch((error) => {
      this.logger.error('Failed to initialize biomes:', error);
    });
    this.loadWorldSeed().catch((error) => {
      this.logger.error('Failed to load world seed:', error);
    });
  }

  private async loadWorldSeed() {
    const activeSeed = await this.prismaService.worldSeed.findFirst({
      where: { isActive: true },
    });

    if (activeSeed) {
      this.currentSeed = activeSeed.seed;
      this.logger.log(`Loaded active world seed: ${this.currentSeed}`);
    } else {
      // Create new seed
      const newSeed = Math.floor(Math.random() * 1000000);
      await this.prismaService.worldSeed.create({
        data: {
          seed: newSeed,
          heightSeed: newSeed,
          temperatureSeed: newSeed + 1000,
          moistureSeed: newSeed + 2000,
        },
      });
      this.currentSeed = newSeed;
      this.logger.log(`Created new world seed: ${this.currentSeed}`);
    }
  }
  private async initializeBiomes() {
    for (const biome of Object.values(BIOMES)) {
      await this.prismaService.biome.upsert({
        where: { id: biome.id },
        update: { name: biome.name },
        create: { id: biome.id, name: biome.name },
      });
    }
  }
  async getChunk(chunkX: number, chunkY: number): Promise<ChunkData> {
    const startTime = Date.now();

    try {
      // Check database for existing tiles
      const existingTiles = await this.getChunkFromDatabase(chunkX, chunkY);

      if (existingTiles.length === 2500) {
        const chunkData = this.reconstructChunkFromTiles(existingTiles);

        return chunkData;
      }

      // Generate new chunk
      const chunkData = this.generateNewChunk(chunkX, chunkY);

      // Store in database
      await this.saveChunkToDatabase(chunkData);

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
  private async getChunkFromDatabase(
    chunkX: number,
    chunkY: number,
  ): Promise<CachedTile[]> {
    const tiles = await this.prismaService.worldTile.findMany({
      where: {
        x: chunkX,
        y: chunkY,
      },
      include: { biome: true },
    });

    return tiles;
  }
  private reconstructChunkFromTiles(tiles: CachedTile[]): ChunkData {
    const biomeCount: Record<string, number> = {};
    let totalHeight = 0;
    let totalTemperature = 0;
    let totalMoisture = 0;

    const tileData: TileData[] = tiles.map((tile) => {
      biomeCount[tile.biomeName] = (biomeCount[tile.biomeName] || 0) + 1;
      totalHeight += tile.height;
      totalTemperature += tile.temperature;
      totalMoisture += tile.moisture;

      return {
        x: tile.x,
        y: tile.y,
        height: tile.height,
        temperature: tile.temperature,
        moisture: tile.moisture,
        biome: BIOMES[tile.biomeName] || BIOMES.GRASSLAND,
      };
    });

    return {
      tiles: tileData,
      settlements: [], // Would need to fetch from Settlement table
      stats: {
        biomes: biomeCount,
        averageHeight: totalHeight / tiles.length,
        averageTemperature: totalTemperature / tiles.length,
        averageMoisture: totalMoisture / tiles.length,
      },
    };
  }
  private generateNewChunk(chunkX: number, chunkY: number) {
    const result = this.generateChunk(chunkX, chunkY, this.currentSeed);
    return result;
  }

  private generateChunk(
    chunkX: number,
    chunkY: number,
    seed: number,
  ): ChunkData {
    const config: WorldSeedConfig = {
      heightSeed: seed,
      temperatureSeed: seed + 1000,
      moistureSeed: seed + 2000,
      ...DEFAULT_WORLD_CONFIG,
    };

    const noiseGenerator = new NoiseGenerator(config);
    const settlementGenerator = new SettlementGenerator(seed);

    const tiles: TileData[] = [];
    const settlements: ChunkData['settlements'] = [];
    const biomeCount: Record<string, number> = {};

    let totalHeight = 0;
    let totalTemperature = 0;
    let totalMoisture = 0;

    // Generate 50x50 tiles for this chunk
    const CHUNK_SIZE = 50;
    const startX = chunkX * CHUNK_SIZE;
    const startY = chunkY * CHUNK_SIZE;

    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      for (let localY = 0; localY < CHUNK_SIZE; localY++) {
        const worldX = startX + localX;
        const worldY = startY + localY;

        const height = noiseGenerator.generateHeight(worldX, worldY);
        const temperature = noiseGenerator.generateTemperature(worldX, worldY);
        const moisture = noiseGenerator.generateMoisture(worldX, worldY);

        const biome = BiomeGenerator.determineBiome(
          height,
          temperature,
          moisture,
        );

        tiles.push({
          x: worldX,
          y: worldY,
          height,
          temperature,
          moisture,
          biome,
        });

        // Update statistics
        biomeCount[biome.name] = (biomeCount[biome.name] || 0) + 1;
        totalHeight += height;
        totalTemperature += temperature;
        totalMoisture += moisture;

        // Check for settlement generation
        if (
          settlementGenerator.shouldGenerateSettlement(worldX, worldY, biome)
        ) {
          // Ensure no overlap with existing settlements
          const hasOverlap = settlements.some((existingSettlement) => {
            const distance = Math.sqrt(
              (existingSettlement.x - worldX) ** 2 +
                (existingSettlement.y - worldY) ** 2,
            );
            // Prevent settlements from being too close - use a simple distance check
            // Large settlements need more space around them
            const minDistance = this.getMinDistanceBetweenSettlements(
              existingSettlement.size,
            );
            return distance < minDistance;
          });

          if (!hasOverlap) {
            const settlement = settlementGenerator.generateSettlement(
              worldX,
              worldY,
              biome,
            );
            settlements.push(settlement);
          }
        }
      }
    }

    const totalTiles = CHUNK_SIZE * CHUNK_SIZE;

    return {
      tiles,
      settlements,
      stats: {
        biomes: biomeCount,
        averageHeight: totalHeight / totalTiles,
        averageTemperature: totalTemperature / totalTiles,
        averageMoisture: totalMoisture / totalTiles,
      },
    };
  }

  private async saveChunkToDatabase(chunkData: ChunkData): Promise<void> {
    // Save tiles
    const tileData = chunkData.tiles.map((tile) => ({
      x: tile.x,
      y: tile.y,
      biomeId: tile.biome.id,
      biomeName: tile.biome.name,
      description: BiomeGenerator.generateTileDescription(
        tile.biome,
        tile.height,
        tile.temperature,
        tile.moisture,
      ),
      height: tile.height,
      temperature: tile.temperature,
      moisture: tile.moisture,
      seed: this.currentSeed,
      chunkX: Math.floor(tile.x / 50),
      chunkY: Math.floor(tile.y / 50),
    }));

    await this.prismaService.worldTile.createMany({
      data: tileData,
      skipDuplicates: true,
    });

    // Save settlements
    const settlementData = chunkData.settlements.map((settlement) => ({
      name: settlement.name,
      type: settlement.type,
      size: settlement.size,
      population: settlement.population,
      x: settlement.x,
      y: settlement.y,
      description: settlement.description,
    }));

    if (settlementData.length > 0) {
      await this.prismaService.settlement.createMany({
        data: settlementData,
        skipDuplicates: true,
      });
    }
  }

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

  async getTileWithNearbyBiomes(
    x: number,
    y: number,
  ): Promise<TileWithNearbyBiomes> {
    const tile = await this.getTile(x, y);
    if (!tile) {
      throw new Error(`Tile not found at ${x},${y}`);
    }

    // Get nearby tiles to find different biomes
    const nearbyBiomes: Array<{
      biomeName: string;
      distance: number;
      direction: string;
    }> = [];
    const seenBiomes = new Set([tile.biomeName]);

    // Check in expanding radius - reduced from 10 to 5 to prevent too many recursive calls
    for (let radius = 1; radius <= 5 && nearbyBiomes.length < 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // Only check perimeter

          try {
            const nearbyTile = await this.getTile(x + dx, y + dy);
            if (nearbyTile && !seenBiomes.has(nearbyTile.biomeName)) {
              seenBiomes.add(nearbyTile.biomeName);

              const distance = Math.sqrt(dx * dx + dy * dy);
              let direction = '';

              if (dx > 0 && dy > 0) direction = 'southeast';
              else if (dx > 0 && dy < 0) direction = 'northeast';
              else if (dx < 0 && dy > 0) direction = 'southwest';
              else if (dx < 0 && dy < 0) direction = 'northwest';
              else if (dx > 0) direction = 'east';
              else if (dx < 0) direction = 'west';
              else if (dy > 0) direction = 'south';
              else direction = 'north';

              nearbyBiomes.push({
                biomeName: nearbyTile.biomeName,
                distance: Math.round(distance * 10) / 10,
                direction,
              });

              // Stop if we have enough biomes
              if (nearbyBiomes.length >= 5) break;
            }
          } catch (error) {
            // Log but don't fail - just skip this nearby tile
            this.logger.debug(
              `Failed to get nearby tile at ${x + dx},${y + dy}:`,
              error,
            );
          }
        }
        if (nearbyBiomes.length >= 5) break;
      }
    }

    // Find nearby settlements within radius 50
    const radius = 50;
    const settlements = await this.prismaService.settlement.findMany({
      where: {
        x: { gte: x - radius, lte: Number(x + radius) },
        y: { gte: y - radius, lte: Number(y + radius) },
      },
    });

    // Calculate distance for each settlement and filter by true radius
    const nearbySettlements = settlements
      .map((s) => ({
        ...s,
        distance: Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2),
      }))
      .filter((s) => s.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    // Check if the current tile is part of any settlement footprint
    let settlementInfo:
      | {
          name: string;
          type: string;
          size: string;
          intensity: number;
          isCenter: boolean;
        }
      | undefined;

    for (const settlement of settlements) {
      // Check if this is the settlement center
      if (settlement.x === x && settlement.y === y) {
        settlementInfo = {
          name: settlement.name,
          type: settlement.type,
          size: settlement.size,
          intensity: 1.0,
          isCenter: true,
        };
        break;
      }

      // Check if this tile is within the settlement footprint
      const footprint = this.regenerateSettlementFootprint({
        x: settlement.x,
        y: settlement.y,
        size: settlement.size,
      });

      const tile = footprint.tiles.find((t) => t.x === x && t.y === y);
      if (tile) {
        settlementInfo = {
          name: settlement.name,
          type: settlement.type,
          size: settlement.size,
          intensity: tile.intensity,
          isCenter: false,
        };
        break; // Use the first settlement found (closest one should be first)
      }
    }

    return {
      ...tile,
      nearbyBiomes: nearbyBiomes.slice(0, 5), // Return up to 5 nearby biomes
      nearbySettlements: nearbySettlements.map((s) => ({
        name: s.name,
        type: s.type,
        size: s.size,
        population: s.population,
        x: s.x,
        y: s.y,
        description: s.description,
        distance: Math.round(s.distance * 10) / 10,
      })),
      settlement: settlementInfo,
    };
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

  private async getTile(
    x: number,
    y: number,
    retryCount = 0,
  ): Promise<CachedTile | null> {
    // Prevent infinite recursion
    if (retryCount > 2) {
      this.logger.error(`Max retries reached for tile ${x},${y}`);
      return null;
    }

    // Check database
    const dbTile = await this.prismaService.worldTile.findUnique({
      where: {
        x_y: {
          x,
          y,
        },
      },
      include: { biome: true },
    });

    if (dbTile) {
      return dbTile;
    }
    // Generate the chunk that contains this tile
    const chunkX = Math.floor(x / 50);
    const chunkY = Math.floor(y / 50);

    try {
      await this.getChunk(chunkX, chunkY);

      // Try again from cache/db with incremented retry count
      return this.getTile(x, y, retryCount + 1);
    } catch (error) {
      this.logger.error(
        `Failed to generate chunk ${chunkX},${chunkY} for tile ${x},${y}:`,
        error,
      );
      return null;
    }
  }
  public isCoordinateInSettlement(
    x: number,
    y: number,
    settlements: Array<{
      x: number;
      y: number;
      size: string;
      name: string;
      type: string;
    }>,
  ): { isSettlement: boolean; settlement?: SettlementData; intensity: number } {
    for (const settlement of settlements) {
      const footprint = this.regenerateSettlementFootprint(settlement);
      const tile = footprint.tiles.find((t) => t.x === x && t.y === y);

      if (tile) {
        return {
          isSettlement: true,
          settlement: settlement as SettlementData,
          intensity: tile.intensity,
        };
      }
    }

    return { isSettlement: false, intensity: 0 };
  }
}
