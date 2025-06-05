import { PrismaClient } from '@prisma/client';
import { redisClient, CACHE_KEYS, CACHE_TTL } from './redis-service';
import { WorkerPool, WorkerTask } from './worker-pool';
import { TileData, BiomeGenerator, BIOMES } from '../utils/biome';
import { logger } from '../utils/logger';
import { createCanvas } from 'canvas';

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

interface TileWithNearbyBiomes extends CachedTile {
  nearbyBiomes: Array<{
    biomeName: string;
    distance: number;
    direction: string;
  }>;
}

interface ChunkData {
  tiles: TileData[];
  settlements: Array<{
    name: string;
    type: string;
    size: string;
    population: number;
    x: number;
    y: number;
    description: string;
  }>;
  stats: {
    biomes: Record<string, number>;
    averageHeight: number;
    averageTemperature: number;
    averageMoisture: number;
  };
}

interface WorldStats {
  totalTiles: number;
  totalChunks: number;
  biomeDistribution: Record<string, number>;
  cacheHitRate: number;
  databaseHitRate: number;
  generationStats: {
    averageChunkGenerationTime: number;
    totalChunksGenerated: number;
  };
}

export class WorldService {
  private prisma: PrismaClient;
  private workerPool: WorkerPool;
  private currentSeed = 12345; // Default seed
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    dbHits: 0,
    dbMisses: 0,
    chunksGenerated: 0,
    totalGenerationTime: 0,
  };

  constructor() {
    this.prisma = new PrismaClient();
    this.workerPool = new WorkerPool(4);
  }

  async initialize(): Promise<void> {
    logger.info('Initializing World Service');

    try {
      await this.workerPool.initialize();
      await this.initializeBiomes();
      await this.loadWorldSeed();
      logger.info('World Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize World Service:', error);
      throw error;
    }
  }

  private async initializeBiomes(): Promise<void> {
    // Ensure all biomes exist in the database
    for (const biome of Object.values(BIOMES)) {
      await this.prisma.biome.upsert({
        where: { id: biome.id },
        update: { name: biome.name },
        create: { id: biome.id, name: biome.name },
      });
    }
  }

  private async loadWorldSeed(): Promise<void> {
    const activeSeed = await this.prisma.worldSeed.findFirst({
      where: { isActive: true },
    });

    if (activeSeed) {
      this.currentSeed = activeSeed.seed;
      logger.info(`Loaded active world seed: ${this.currentSeed}`);
    } else {
      // Create new seed
      const newSeed = Math.floor(Math.random() * 1000000);
      await this.prisma.worldSeed.create({
        data: {
          seed: newSeed,
          heightSeed: newSeed,
          temperatureSeed: newSeed + 1000,
          moistureSeed: newSeed + 2000,
        },
      });
      this.currentSeed = newSeed;
      logger.info(`Created new world seed: ${this.currentSeed}`);
    }
  }

  async getChunk(chunkX: number, chunkY: number): Promise<ChunkData> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = CACHE_KEYS.CHUNK(chunkX, chunkY);
      const cachedChunk = await redisClient.get(cacheKey);

      if (cachedChunk) {
        this.stats.cacheHits++;
        logger.debug(`Cache hit for chunk ${chunkX},${chunkY}`);
        return JSON.parse(cachedChunk);
      }

      this.stats.cacheMisses++;
      logger.debug(`Cache miss for chunk ${chunkX},${chunkY}`);

      // Check database for existing tiles
      const existingTiles = await this.getChunkFromDatabase(chunkX, chunkY);

      if (existingTiles.length === 2500) {
        // Full 50x50 chunk
        this.stats.dbHits++;
        const chunkData = this.reconstructChunkFromTiles(existingTiles);

        // Cache the result
        await redisClient.setex(
          cacheKey,
          CACHE_TTL.CHUNK,
          JSON.stringify(chunkData)
        );

        return chunkData;
      }

      this.stats.dbMisses++;

      // Generate new chunk
      const chunkData = await this.generateNewChunk(chunkX, chunkY);

      // Store in database
      await this.saveChunkToDatabase(chunkData);

      // Cache the result
      await redisClient.setex(
        cacheKey,
        CACHE_TTL.CHUNK,
        JSON.stringify(chunkData)
      );

      const generationTime = Date.now() - startTime;
      this.stats.chunksGenerated++;
      this.stats.totalGenerationTime += generationTime;

      logger.info(
        `Generated chunk ${chunkX},${chunkY} in ${generationTime}ms. Biomes: ${Object.keys(
          chunkData.stats.biomes
        ).join(', ')}`
      );

      return chunkData;
    } catch (error) {
      logger.error(`Error getting chunk ${chunkX},${chunkY}:`, error);
      throw error;
    }
  }

  async getTileWithNearbyBiomes(
    x: number,
    y: number
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
            logger.debug(
              `Failed to get nearby tile at ${x + dx},${y + dy}:`,
              error
            );
          }
        }
        if (nearbyBiomes.length >= 5) break;
      }
    }

    return {
      ...tile,
      nearbyBiomes: nearbyBiomes.slice(0, 5), // Return up to 5 nearby biomes
    };
  }

  private async getTile(
    x: number,
    y: number,
    retryCount = 0
  ): Promise<CachedTile | null> {
    // Prevent infinite recursion
    if (retryCount > 2) {
      logger.error(`Max retries reached for tile ${x},${y}`);
      return null;
    }

    // Check cache first
    const cacheKey = CACHE_KEYS.TILE(x, y);
    const cachedTile = await redisClient.get(cacheKey);

    if (cachedTile) {
      this.stats.cacheHits++;
      return JSON.parse(cachedTile);
    }

    this.stats.cacheMisses++;

    // Check database
    const dbTile = await this.prisma.worldTile.findUnique({
      where: { x_y: { x, y } },
      include: { biome: true },
    });

    if (dbTile) {
      this.stats.dbHits++;
      const tile: CachedTile = {
        x: dbTile.x,
        y: dbTile.y,
        biomeId: dbTile.biomeId,
        biomeName: dbTile.biomeName,
        description: dbTile.description,
        height: dbTile.height,
        temperature: dbTile.temperature,
        moisture: dbTile.moisture,
        seed: dbTile.seed,
        chunkX: dbTile.chunkX,
        chunkY: dbTile.chunkY,
      };

      // Cache it
      await redisClient.setex(cacheKey, CACHE_TTL.TILE, JSON.stringify(tile));
      return tile;
    }

    this.stats.dbMisses++;

    // Generate the chunk that contains this tile
    const chunkX = Math.floor(x / 50);
    const chunkY = Math.floor(y / 50);

    try {
      await this.getChunk(chunkX, chunkY);

      // Try again from cache/db with incremented retry count
      return this.getTile(x, y, retryCount + 1);
    } catch (error) {
      logger.error(
        `Failed to generate chunk ${chunkX},${chunkY} for tile ${x},${y}:`,
        error
      );
      return null;
    }
  }

  private async getChunkFromDatabase(
    chunkX: number,
    chunkY: number
  ): Promise<CachedTile[]> {
    const tiles = await this.prisma.worldTile.findMany({
      where: {
        chunkX,
        chunkY,
      },
      include: { biome: true },
    });

    return tiles.map((tile) => ({
      x: tile.x,
      y: tile.y,
      biomeId: tile.biomeId,
      biomeName: tile.biomeName,
      description: tile.description,
      height: tile.height,
      temperature: tile.temperature,
      moisture: tile.moisture,
      seed: tile.seed,
      chunkX: tile.chunkX,
      chunkY: tile.chunkY,
    }));
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

  private async generateNewChunk(
    chunkX: number,
    chunkY: number
  ): Promise<ChunkData> {
    const task: WorkerTask = {
      id: `chunk_${chunkX}_${chunkY}_${Date.now()}`,
      type: 'generateChunk',
      data: {
        chunkX,
        chunkY,
        seed: this.currentSeed,
      },
    };

    const result = await this.workerPool.executeTask(task);
    if (!result.success) {
      throw new Error(`Failed to generate chunk: ${result.error}`);
    }

    return result.data as ChunkData;
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
        tile.moisture
      ),
      height: tile.height,
      temperature: tile.temperature,
      moisture: tile.moisture,
      seed: this.currentSeed,
      chunkX: Math.floor(tile.x / 50),
      chunkY: Math.floor(tile.y / 50),
    }));

    await this.prisma.worldTile.createMany({
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
      await this.prisma.settlement.createMany({
        data: settlementData,
        skipDuplicates: true,
      });
    }
  }

  async renderMap(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): Promise<Buffer> {
    const width = maxX - minX;
    const height = maxY - minY;
    const canvas = createCanvas(width * 4, height * 4); // 4 pixels per tile
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let x = minX; x < maxX; x++) {
      for (let y = minY; y < maxY; y++) {
        try {
          const tile = await this.getTile(x, y);
          if (tile) {
            const biome = BIOMES[tile.biomeName] || BIOMES.GRASSLAND;
            ctx.fillStyle = biome.color;
            const pixelX = (x - minX) * 4;
            const pixelY = (y - minY) * 4;
            ctx.fillRect(pixelX, pixelY, 4, 4);
          }
        } catch {
          // Skip tiles that can't be loaded
        }
      }
    }

    return canvas.toBuffer('image/png');
  }

  async getStatistics(): Promise<WorldStats> {
    const totalTiles = await this.prisma.worldTile.count();
    const totalChunks = Math.ceil(totalTiles / 2500);

    const biomeDistribution = await this.prisma.worldTile.groupBy({
      by: ['biomeName'],
      _count: { biomeName: true },
    });

    const biomeStats: Record<string, number> = {};
    biomeDistribution.forEach((item) => {
      biomeStats[item.biomeName] = item._count.biomeName;
    });

    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const cacheHitRate =
      totalRequests > 0 ? (this.stats.cacheHits / totalRequests) * 100 : 0;

    const totalDbRequests = this.stats.dbHits + this.stats.dbMisses;
    const databaseHitRate =
      totalDbRequests > 0 ? (this.stats.dbHits / totalDbRequests) * 100 : 0;

    return {
      totalTiles,
      totalChunks,
      biomeDistribution: biomeStats,
      cacheHitRate,
      databaseHitRate,
      generationStats: {
        averageChunkGenerationTime:
          this.stats.chunksGenerated > 0
            ? this.stats.totalGenerationTime / this.stats.chunksGenerated
            : 0,
        totalChunksGenerated: this.stats.chunksGenerated,
      },
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down World Service');
    await this.workerPool.shutdown();
    await this.prisma.$disconnect();
  }
}

export const worldService = new WorldService();
