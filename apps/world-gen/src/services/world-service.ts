import { PrismaClient } from '@prisma/client';
import { WorkerPool, WorkerTask } from './worker-pool';
import { TileData, BiomeGenerator, BIOMES } from '../utils/biome';
import { SettlementGenerator, SettlementFootprint } from '../utils/settlement';
import { logger } from '../utils/logger';
import { createCanvas } from 'canvas';
import seedrandom from 'seedrandom';

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

interface ChunkData {
  tiles: TileData[];
  settlements: Array<SettlementData>;
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
      // Check database for existing tiles
      const existingTiles = await this.getChunkFromDatabase(chunkX, chunkY);

      if (existingTiles.length === 2500) {
        // Full 50x50 chunk
        this.stats.dbHits++;
        const chunkData = this.reconstructChunkFromTiles(existingTiles);

        return chunkData;
      }

      this.stats.dbMisses++;

      // Generate new chunk
      const chunkData = await this.generateNewChunk(chunkX, chunkY);

      // Store in database
      await this.saveChunkToDatabase(chunkData);

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

    // Find nearby settlements within radius 50
    const radius = 50;
    const settlements = await this.prisma.settlement.findMany({
      where: {
        x: { gte: x - radius, lte: x + radius },
        y: { gte: y - radius, lte: y + radius },
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

  /**
   * Common data structure for map rendering
   */
  private async prepareMapData(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): Promise<{
    width: number;
    height: number;
    settlementMap: Map<string, SettlementData>;
    existingTileCount: number;
    tileData: Array<{
      x: number;
      y: number;
      tile: CachedTile | null;
      settlement: SettlementData | undefined;
      biome: (typeof BIOMES)[keyof typeof BIOMES] | null;
      hasError: boolean;
    }>;
  }> {
    const width = maxX - minX;
    const height = maxY - minY;

    // Fetch all settlements in the region
    const settlements =
      (await this.prisma.settlement.findMany({
        where: {
          x: { gte: minX, lt: maxX },
          y: { gte: minY, lt: maxY },
        },
      })) || [];
    const settlementMap = new Map(settlements.map((s) => [`${s.x},${s.y}`, s]));

    // Fetch all tiles in the region in one DB call
    const tiles = await this.prisma.worldTile.findMany({
      where: {
        x: { gte: minX, lt: maxX },
        y: { gte: minY, lt: maxY },
      },
      include: { biome: true },
    });
    const tileMap = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]));

    const tileData = [];
    let existingTileCount = 0;

    // Collect all tile data using the tileMap
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        let tile = null;
        let hasError = false;

        try {
          const dbTile = tileMap.get(`${x},${y}`);
          if (dbTile) {
            tile = {
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
            existingTileCount++;
          }
        } catch (error) {
          logger.debug(`Failed to load tile at ${x},${y}:`, error);
          hasError = true;
        }

        const settlement = settlementMap.get(`${x},${y}`);

        // Check if this coordinate is within any settlement footprint
        let settlementFromFootprint: SettlementData | undefined;
        if (!settlement && settlements.length > 0) {
          const settlementCheck = this.isCoordinateInSettlement(
            x,
            y,
            settlements
          );
          if (settlementCheck.isSettlement) {
            settlementFromFootprint = settlementCheck.settlement;
          }
        }

        const finalSettlement = settlement || settlementFromFootprint;

        const biome = tile
          ? Object.values(BIOMES).find(
              (b) => b.name.toLowerCase() === tile.biomeName.toLowerCase()
            ) || BIOMES.GRASSLAND
          : null;

        tileData.push({
          x,
          y,
          tile,
          settlement: finalSettlement,
          biome,
          hasError,
        });
      }
    }

    return {
      width,
      height,
      settlementMap,
      existingTileCount,
      tileData,
    };
  }

  async renderMap(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): Promise<Buffer> {
    const { width, height, existingTileCount, tileData } =
      await this.prepareMapData(minX, maxX, minY, maxY);

    const canvas = createCanvas(width * 4, height * 4); // 4 pixels per tile
    const ctx = canvas.getContext('2d');

    // Background - use a neutral color to show ungenerated areas
    ctx.fillStyle = '#2c2c2c'; // Dark gray for ungenerated areas
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render each tile
    for (const { x, y, tile, settlement, biome } of tileData) {
      const pixelX = (x - minX) * 4;
      const pixelY = (y - minY) * 4;

      if (tile && biome) {
        ctx.fillStyle = biome.color;
        ctx.fillRect(pixelX, pixelY, 4, 4);
      }

      // Overlay settlement if present
      if (settlement) {
        const isCenter = settlement.x === x && settlement.y === y;
        if (isCenter) {
          // Settlement center - bright red
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(pixelX, pixelY, 4, 4);
        } else {
          // Check settlement intensity for footprint areas
          const settlementCheck = this.isCoordinateInSettlement(x, y, [
            settlement,
          ]);
          if (settlementCheck.isSettlement) {
            const intensity = settlementCheck.intensity;
            // Create a semi-transparent red overlay based on intensity
            ctx.fillStyle = `rgba(255, 51, 51, ${intensity * 0.8})`;
            ctx.fillRect(pixelX, pixelY, 4, 4);
          } else {
            // Fallback - small red dot
            ctx.fillStyle = '#ff3333';
            ctx.fillRect(pixelX + 1, pixelY + 1, 2, 2);
          }
        }
      }
    }

    logger.info(
      `Rendered map with ${existingTileCount} existing tiles out of ${
        width * height
      } total coordinates`
    );
    return canvas.toBuffer('image/png');
  }

  async renderMapAscii(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): Promise<string> {
    const { width, height, existingTileCount, tileData } =
      await this.prepareMapData(minX, maxX, minY, maxY);

    let asciiMap = '';

    // Add a header with coordinate information
    asciiMap += `ASCII Map (${minX},${minY}) to (${maxX - 1},${maxY - 1})\n`;
    asciiMap += `Legend: ~ Ocean, ≈ Shallow Ocean, . Beach, d Desert, g Grassland, T Forest\n`;
    asciiMap += `        J Jungle, S Swamp, L Lake, r River, t Tundra, P Taiga\n`;
    asciiMap += `        ^ Mountain, A Snowy Mountain, h Hills, s Savanna, a Alpine, V Volcanic\n`;
    asciiMap += `        ★ Settlement Center, ▓ Dense Settlement, ░ Sparse Settlement, • Ungenerated area\n\n`;

    // Render each row
    for (let y = minY; y < maxY; y++) {
      let row = '';
      for (let x = minX; x < maxX; x++) {
        const tileInfo = tileData.find((t) => t.x === x && t.y === y);
        if (!tileInfo) continue;

        const { settlement, tile, biome, hasError } = tileInfo;

        if (settlement) {
          // Check if this is exactly the settlement center or part of footprint
          const isCenter = settlement.x === x && settlement.y === y;
          if (isCenter) {
            row += '★'; // Settlement center marker
          } else {
            // Get settlement intensity for this tile
            const settlementCheck = this.isCoordinateInSettlement(x, y, [
              settlement,
            ]);
            if (settlementCheck.isSettlement) {
              const intensity = settlementCheck.intensity;
              if (intensity > 0.7) {
                row += '▓'; // Dense settlement
              } else if (intensity > 0.3) {
                row += '▒'; // Medium settlement
              } else {
                row += '░'; // Sparse settlement
              }
            } else {
              row += '*'; // Fallback settlement marker
            }
          }
        } else if (tile && biome) {
          row += biome.ascii;
        } else if (hasError) {
          row += '?'; // Error character
        } else {
          row += '•'; // Ungenerated area
        }
      }
      asciiMap += row + '\n';
    }

    // Add a footer with statistics
    asciiMap += `\nExisting tiles: ${existingTileCount}/${width * height} (${(
      (existingTileCount / (width * height)) *
      100
    ).toFixed(1)}%)\n`;

    logger.info(
      `Rendered ASCII map with ${existingTileCount} existing tiles out of ${
        width * height
      } total coordinates`
    );
    return asciiMap;
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
  /**
   * Regenerate settlement footprint for an existing settlement
   * This is used for backward compatibility with settlements stored without footprints
   */
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
      coordRng
    );
  }

  /**
   * Check if a coordinate is within any settlement, using footprint data
   */
  private isCoordinateInSettlement(
    x: number,
    y: number,
    settlements: Array<{
      x: number;
      y: number;
      size: string;
      name: string;
      type: string;
    }>
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

export const worldService = new WorldService();
