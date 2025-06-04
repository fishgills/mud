import { NoiseGenerator } from './noise-generator';
import { DEFAULT_WORLD_CONFIG, WorldConfig } from './world-config';
import { WorldTile } from './world';
import prisma from '../prisma';
import redis from '../redis';
import { DRYTileUtils } from './tile-utils';

export const CHUNK_SIZE = 50;

export interface ChunkCoordinate {
  chunkX: number;
  chunkY: number;
}

export interface WorldChunk {
  chunkX: number;
  chunkY: number;
  tiles: WorldTile[];
  generatedAt: Date;
}

export class ChunkWorldGenerator {
  private noiseGenerator: NoiseGenerator;
  // private config: WorldConfig; // not used

  // Cache TTL constants
  // private static readonly TILE_CACHE_TTL = 3600; // 1 hour (moved to DRYTileUtils)
  private static readonly CHUNK_CACHE_TTL = 7200; // 2 hours

  constructor(config: WorldConfig = DEFAULT_WORLD_CONFIG) {
    this.noiseGenerator = new NoiseGenerator(config.worldParameters);
    // this.config = config; // not used
  }

  /**
   * Get world coordinates from chunk coordinates
   */
  static chunkToWorld(chunkCoord: ChunkCoordinate): {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } {
    const startX = chunkCoord.chunkX * CHUNK_SIZE;
    const startY = chunkCoord.chunkY * CHUNK_SIZE;
    return {
      startX,
      startY,
      endX: startX + CHUNK_SIZE - 1,
      endY: startY + CHUNK_SIZE - 1,
    };
  }

  /**
   * Get chunk coordinates from world coordinates
   */
  static worldToChunk(x: number, y: number): ChunkCoordinate {
    return {
      chunkX: Math.floor(x / CHUNK_SIZE),
      chunkY: Math.floor(y / CHUNK_SIZE),
    };
  }

  /**
   * Generate cache keys
   */
  private static getCacheKey(
    type: 'tile' | 'chunk',
    ...coords: number[]
  ): string {
    return `${type}:${coords.join(':')}`;
  }

  /**
   * Handle async operations with consistent error handling
   */
  private async handleAsync<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      console.error(`${errorMessage}:`, error);
      return null;
    }
  }

  /**
   * Generate a tile at specific world coordinates
   */
  async generateTile(x: number, y: number): Promise<WorldTile> {
    // Use TileGenerator logic for tile generation
    const terrain = this.noiseGenerator.generateTerrain(x, y);
    const biomeName = DRYTileUtils.determineBiome(terrain);
    return DRYTileUtils.createTileFromBiome(x, y, biomeName);
  }

  /**
   * Generate a tile with cache hit information
   */
  async generateTileWithCacheInfo(
    x: number,
    y: number
  ): Promise<{
    tile: WorldTile;
    cacheHit: boolean;
    source: 'cache' | 'database' | 'generated';
  }> {
    return this.processTileGenerationWithCacheInfo(
      x,
      y,
      () => DRYTileUtils.getTileFromCache(x, y),
      () => DRYTileUtils.findExistingTile(x, y),
      () => this.generateTile(x, y)
    );
  }

  /**
   * Unified tile generation workflow with cache information
   */
  private async processTileGenerationWithCacheInfo(
    x: number,
    y: number,
    getCached: () => Promise<WorldTile | null>,
    getExisting: () => Promise<WorldTile | null>,
    generateNew: () => Promise<WorldTile>
  ): Promise<{
    tile: WorldTile;
    cacheHit: boolean;
    source: 'cache' | 'database' | 'generated';
  }> {
    // Check cache first
    const cached = await getCached();
    if (cached) {
      return { tile: cached, cacheHit: true, source: 'cache' };
    }

    // Check if tile already exists in database
    const existing = await getExisting();
    if (existing) {
      await DRYTileUtils.cacheTile(existing);
      return { tile: existing, cacheHit: false, source: 'database' };
    }

    // Generate new tile
    const tile = await generateNew();

    // Cache and store the generated tile
    await DRYTileUtils.cacheTile(tile);
    await this.storeTileAsync(tile);

    return { tile, cacheHit: false, source: 'generated' };
  }

  /**
   * Load an existing chunk from the database
   */
  private async loadChunkFromDatabase(
    chunkX: number,
    chunkY: number
  ): Promise<WorldChunk | null> {
    const { startX, startY, endX, endY } = ChunkWorldGenerator.chunkToWorld({
      chunkX,
      chunkY,
    });

    const existingTiles = await this.performDatabaseOperation(
      () =>
        prisma.worldTile.findMany({
          where: {
            x: { gte: startX, lte: endX },
            y: { gte: startY, lte: endY },
          },
          include: { biome: true },
          orderBy: [{ x: 'asc' }, { y: 'asc' }],
        }),
      'Error loading chunk from database'
    );

    if (!existingTiles || existingTiles.length !== CHUNK_SIZE * CHUNK_SIZE) {
      return null;
    }

    const tiles: WorldTile[] = existingTiles.map((tile) => ({
      id: tile.id,
      x: tile.x,
      y: tile.y,
      biomeId: tile.biomeId,
      description: tile.description,
    }));

    return {
      chunkX,
      chunkY,
      tiles,
      generatedAt: new Date(), // We don't store generation date, so use current time
    };
  }

  /**
   * Generate an entire chunk
   */
  async generateChunk(chunkX: number, chunkY: number): Promise<WorldChunk> {
    const cacheKey = ChunkWorldGenerator.getCacheKey('chunk', chunkX, chunkY);

    // Check if chunk is cached
    const cachedChunk = await this.getCachedData<WorldChunk>(cacheKey);
    if (cachedChunk) {
      return cachedChunk;
    }

    // Check if chunk exists in database
    const existingChunk = await this.loadChunkFromDatabase(chunkX, chunkY);
    if (existingChunk) {
      // Cache the loaded chunk
      await this.setCachedData(
        cacheKey,
        ChunkWorldGenerator.CHUNK_CACHE_TTL,
        existingChunk
      );
      return existingChunk;
    }

    // Generate chunk tiles
    const tiles = await this.generateChunkTiles(chunkX, chunkY);

    const chunk: WorldChunk = {
      chunkX,
      chunkY,
      tiles,
      generatedAt: new Date(),
    };

    // Cache and store the chunk
    await this.setCachedData(
      cacheKey,
      ChunkWorldGenerator.CHUNK_CACHE_TTL,
      chunk
    );
    await this.storeChunkAsync(chunk);
    return chunk;
  }

  /**
   * Generate an entire chunk with cache information
   */
  async generateChunkWithCacheInfo(
    chunkX: number,
    chunkY: number
  ): Promise<{
    chunk: WorldChunk;
    cacheHit: boolean;
    source: 'cache' | 'database' | 'generated';
  }> {
    const cacheKey = ChunkWorldGenerator.getCacheKey('chunk', chunkX, chunkY);

    // Check if chunk is cached
    const cachedChunk = await this.getCachedData<WorldChunk>(cacheKey);
    if (cachedChunk) {
      return { chunk: cachedChunk, cacheHit: true, source: 'cache' };
    }

    // Check if chunk already exists in database
    const existingChunk = await this.loadChunkFromDatabase(chunkX, chunkY);
    if (existingChunk) {
      // Cache the existing chunk
      await this.setCachedData(
        cacheKey,
        ChunkWorldGenerator.CHUNK_CACHE_TTL,
        existingChunk
      );
      return { chunk: existingChunk, cacheHit: false, source: 'database' };
    }

    // Generate chunk tiles only if chunk doesn't exist
    const tiles = await this.generateChunkTiles(chunkX, chunkY);

    const chunk: WorldChunk = {
      chunkX,
      chunkY,
      tiles,
      generatedAt: new Date(),
    };

    // Cache and store the chunk
    await this.setCachedData(
      cacheKey,
      ChunkWorldGenerator.CHUNK_CACHE_TTL,
      chunk
    );
    this.handleAsync(
      () => this.storeChunkAsync(chunk),
      'Error storing chunk async'
    );

    return { chunk, cacheHit: false, source: 'generated' };
  }

  /**
   * Generate all tiles for a chunk
   */
  private async generateChunkTiles(
    chunkX: number,
    chunkY: number
  ): Promise<WorldTile[]> {
    const terrainGrid = this.noiseGenerator.generateChunkTerrain(
      chunkX,
      chunkY,
      CHUNK_SIZE
    );
    const tiles: WorldTile[] = [];
    const { startX, startY } = ChunkWorldGenerator.chunkToWorld({
      chunkX,
      chunkY,
    });

    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      for (let localY = 0; localY < CHUNK_SIZE; localY++) {
        const worldX = startX + localX;
        const worldY = startY + localY;
        const terrain = terrainGrid[localX][localY];

        const biomeName = DRYTileUtils.determineBiome(terrain);
        const tile = await DRYTileUtils.createTileFromBiome(
          worldX,
          worldY,
          biomeName
        );
        tiles.push(tile);
      }
    }

    return tiles;
  }
  /**
   * Generic database operation with caching
   */
  private async performDatabaseOperation<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    cacheKey?: string,
    cacheTtl?: number,
    cacheValue?: unknown
  ): Promise<T | null> {
    const result = await this.handleAsync(operation, errorMessage);

    if (
      result &&
      cacheKey &&
      cacheTtl !== undefined &&
      cacheValue !== undefined
    ) {
      await this.handleAsync(
        () => redis.set(cacheKey, JSON.stringify(cacheValue)),
        errorMessage
      );
    }

    return result;
  }

  /**
   * Cache operations - unified for better DRY
   */
  private async getCachedData<T>(cacheKey: string): Promise<T | null> {
    const result = await redis.get(cacheKey);
    return result ? JSON.parse(result) : null;
  }

  private async setCachedData<T>(cacheKey: string, ttl: number, data: T) {
    return redis.set(cacheKey, JSON.stringify(data), 'EX', ttl);
  }

  /**
   * Database operations - unified storage methods
   */
  private async storeTileAsync(tile: WorldTile): Promise<WorldTile | null> {
    const stored = await this.performDatabaseOperation(
      () =>
        prisma.worldTile.upsert({
          where: {
            x_y: {
              x: tile.x,
              y: tile.y,
            },
          },
          update: {
            // Only update if the tile data has changed
            biomeId: tile.biomeId,
            description: tile.description,
          },
          create: {
            x: tile.x,
            y: tile.y,
            biomeId: tile.biomeId,
            description: tile.description,
          },
        }),
      'Error storing tile to database'
    );

    if (stored) {
      // Update cache with real ID
      const updatedTile = { ...tile, id: stored.id };
      await DRYTileUtils.cacheTile(updatedTile);
      return updatedTile;
    }
    return null;
  }

  private async storeChunkAsync(chunk: WorldChunk): Promise<void> {
    const tilesToStore = chunk.tiles.filter((tile) => tile.id === 0);

    if (tilesToStore.length === 0) {
      return; // No tiles to store
    }

    const storedTiles = await this.performDatabaseOperation(
      () => Promise.all(tilesToStore.map((tile) => this.storeTileAsync(tile))),
      'Error storing chunk to database'
    );

    // Update chunk with stored tile IDs
    if (storedTiles) {
      storedTiles.forEach((storedTile) => {
        if (storedTile) {
          const originalTile = chunk.tiles.find(
            (t) => t.x === storedTile.x && t.y === storedTile.y
          );
          if (originalTile) {
            originalTile.id = storedTile.id;
          }
        }
      });
    }
  }
}
