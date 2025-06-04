import { NoiseGenerator, TerrainData } from './noise-generator';
import { DEFAULT_WORLD_CONFIG, WorldConfig } from './world-config';
import { BiomeMapper } from './biome-mapper';
import { WorldTile } from './world';
import prisma from '../prisma';
import redis from '../redis';

export const CHUNK_SIZE = 50;

// Constants for settlement calculations
const SETTLEMENT_HASH_MOD = 10000;

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
  private config: WorldConfig;

  // Cache TTL constants
  private static readonly TILE_CACHE_TTL = 3600; // 1 hour
  private static readonly CHUNK_CACHE_TTL = 7200; // 2 hours

  constructor(config: WorldConfig = DEFAULT_WORLD_CONFIG) {
    this.noiseGenerator = new NoiseGenerator(config.worldParameters);
    this.config = config;
  }

  /**
   * Get world coordinates from chunk coordinates
   */
  static chunkToWorld(chunkCoord: ChunkCoordinate): { startX: number; startY: number; endX: number; endY: number } {
    const startX = chunkCoord.chunkX * CHUNK_SIZE;
    const startY = chunkCoord.chunkY * CHUNK_SIZE;
    return {
      startX,
      startY,
      endX: startX + CHUNK_SIZE - 1,
      endY: startY + CHUNK_SIZE - 1
    };
  }

  /**
   * Get chunk coordinates from world coordinates
   */
  static worldToChunk(x: number, y: number): ChunkCoordinate {
    return {
      chunkX: Math.floor(x / CHUNK_SIZE),
      chunkY: Math.floor(y / CHUNK_SIZE)
    };
  }

  /**
   * Generate cache keys
   */
  private static getCacheKey(type: 'tile' | 'chunk', ...coords: number[]): string {
    return `${type}:${coords.join(':')}`;
  }

  /**
   * Handle async operations with consistent error handling
   */
  private async handleAsync<T>(operation: () => Promise<T>, errorMessage: string): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      console.error(`${errorMessage}:`, error);
      return null;
    }
  }

  /**
   * Determine the appropriate biome for a location, handling settlements
   */
  private determineBiome(terrain: TerrainData, x: number, y: number): string {
    let biomeName = BiomeMapper.getBiome(terrain);
    
    // Apply settlement spacing rules
    if (BiomeMapper.isSettlement(biomeName)) {
      if (!this.shouldPlaceSettlement(x, y, biomeName)) {
        biomeName = this.getNaturalBiomeAlternative(terrain);
      }
    }
    
    return biomeName;
  }

  /**
   * Generate a tile at specific world coordinates
   */
  async generateTile(x: number, y: number): Promise<WorldTile> {
    const result = await this.generateTileWithCacheInfo(x, y);
    return result.tile;
  }

  /**
   * Generate a tile with cache hit information
   */
  async generateTileWithCacheInfo(x: number, y: number): Promise<{ tile: WorldTile; cacheHit: boolean; source: 'cache' | 'database' | 'generated' }> {
    return this.processTileGenerationWithCacheInfo(
      x, 
      y, 
      () => this.getTileFromCache(x, y),
      () => this.findExistingTile(x, y),
      () => this.generateNewTile(x, y)
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
  ): Promise<{ tile: WorldTile; cacheHit: boolean; source: 'cache' | 'database' | 'generated' }> {
    // Check cache first
    const cached = await getCached();
    if (cached) {
      return { tile: cached, cacheHit: true, source: 'cache' };
    }

    // Check if tile already exists in database
    const existing = await getExisting();
    if (existing) {
      await this.cacheTile(existing);
      return { tile: existing, cacheHit: false, source: 'database' };
    }

    // Generate new tile
    const tile = await generateNew();
    
    // Cache and store the generated tile
    await this.cacheTile(tile);
    this.handleAsync(() => this.storeTileAsync(tile), 'Error storing tile async');
    
    return { tile, cacheHit: false, source: 'generated' };
  }

  /**
   * Generate an entire chunk
   */
  async generateChunk(chunkX: number, chunkY: number): Promise<WorldChunk> {
    const cacheKey = ChunkWorldGenerator.getCacheKey('chunk', chunkX, chunkY);
    
    // Check if chunk is cached
    const cachedChunk = await this.getCachedData<WorldChunk>(cacheKey, 'Error getting chunk from cache');
    if (cachedChunk) {
      return cachedChunk;
    }

    // Generate chunk tiles
    const tiles = await this.generateChunkTiles(chunkX, chunkY);

    const chunk: WorldChunk = {
      chunkX,
      chunkY,
      tiles,
      generatedAt: new Date()
    };

    // Cache and store the chunk
    await this.setCachedData(cacheKey, ChunkWorldGenerator.CHUNK_CACHE_TTL, chunk, 'Error caching chunk');
    this.handleAsync(() => this.storeChunkAsync(chunk), 'Error storing chunk async');

    return chunk;
  }

  /**
   * Generate an entire chunk with cache information
   */
  async generateChunkWithCacheInfo(chunkX: number, chunkY: number): Promise<{ chunk: WorldChunk; cacheHit: boolean; source: 'cache' | 'generated' }> {
    const cacheKey = ChunkWorldGenerator.getCacheKey('chunk', chunkX, chunkY);
    
    // Check if chunk is cached
    const cachedChunk = await this.getCachedData<WorldChunk>(cacheKey, 'Error getting chunk from cache');
    if (cachedChunk) {
      return { chunk: cachedChunk, cacheHit: true, source: 'cache' };
    }

    // Generate chunk tiles
    const tiles = await this.generateChunkTiles(chunkX, chunkY);

    const chunk: WorldChunk = {
      chunkX,
      chunkY,
      tiles,
      generatedAt: new Date()
    };

    // Cache and store the chunk
    await this.setCachedData(cacheKey, ChunkWorldGenerator.CHUNK_CACHE_TTL, chunk, 'Error caching chunk');
    this.handleAsync(() => this.storeChunkAsync(chunk), 'Error storing chunk async');

    return { chunk, cacheHit: false, source: 'generated' };
  }

  /**
   * Generate all tiles for a chunk
   */
  private async generateChunkTiles(chunkX: number, chunkY: number): Promise<WorldTile[]> {
    const terrainGrid = this.noiseGenerator.generateChunkTerrain(chunkX, chunkY, CHUNK_SIZE);
    const tiles: WorldTile[] = [];
    const { startX, startY } = ChunkWorldGenerator.chunkToWorld({ chunkX, chunkY });

    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      for (let localY = 0; localY < CHUNK_SIZE; localY++) {
        const worldX = startX + localX;
        const worldY = startY + localY;
        const terrain = terrainGrid[localX][localY];
        
        const tile = await this.createTileFromTerrain(worldX, worldY, terrain);
        tiles.push(tile);
      }
    }

    return tiles;
  }

  /**
   * Find existing tile in database
   */
  private async findExistingTile(x: number, y: number): Promise<WorldTile | null> {
    const existingTile = await this.performDatabaseOperation(
      () => prisma.worldTile.findUnique({ 
        where: { x_y: { x, y } },
        include: { biome: true }
      }),
      'Error finding existing tile'
    );
    
    if (!existingTile) return null;

    return {
      id: existingTile.id,
      x: existingTile.x,
      y: existingTile.y,
      biomeId: existingTile.biomeId,
      description: existingTile.description,
    };
  }

  /**
   * Generate a new tile using noise-based generation
   */
  private async generateNewTile(x: number, y: number): Promise<WorldTile> {
    const terrain = this.noiseGenerator.generateTerrain(x, y);
    return this.createTileFromTerrain(x, y, terrain);
  }

  /**
   * Create a tile from terrain data (unified logic for both single tiles and chunk generation)
   */
  private async createTileFromTerrain(
    x: number, 
    y: number, 
    terrain: TerrainData
  ): Promise<WorldTile> {
    const biomeName = this.determineBiome(terrain, x, y);
    return this.createTileFromBiome(x, y, biomeName);
  }

  /**
   * Create a WorldTile from biome information
   */
  private async createTileFromBiome(x: number, y: number, biomeName: string): Promise<WorldTile> {
    const biome = await this.getOrCreateBiome(biomeName);
    if (!biome) {
      throw new Error(`Failed to get or create biome: ${biomeName}`);
    }
    
    const description = `You are in a ${biomeName} at (${x}, ${y}).`;

    return {
      id: 0, // Will be set when stored in database
      x,
      y,
      biomeId: biome.id,
      description,
    };
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
    
    if (result && cacheKey && cacheTtl !== undefined && cacheValue !== undefined) {
      await this.handleAsync(
        () => redis.setEx(cacheKey, cacheTtl, JSON.stringify(cacheValue)),
        'Error caching operation result'
      );
    }
    
    return result;
  }

  /**
   * Get or create biome in database
   */
  private async getOrCreateBiome(biomeName: string) {
    return this.performDatabaseOperation(
      async () => {
        let biome = await prisma.biome.findUnique({ where: { name: biomeName } });
        if (!biome) {
          biome = await prisma.biome.create({
            data: { name: biomeName }
          });
        }
        return biome;
      },
      `Error getting or creating biome: ${biomeName}`
    );
  }

  /**
   * Settlement placement logic
   */
  private shouldPlaceSettlement(x: number, y: number, settlementType: string): boolean {
    const hash = this.simpleHash(x, y, settlementType);
    const probability = this.getSettlementProbability(settlementType);
    
    if ((hash % SETTLEMENT_HASH_MOD) / SETTLEMENT_HASH_MOD < probability) {
      const spacing = this.getSettlementSpacing(settlementType);
      return this.isLocationSuitableForSettlement(x, y, spacing);
    }
    
    return false;
  }

  private getSettlementProbability(settlementType: string): number {
    return settlementType === 'city' 
      ? this.config.cityProbability 
      : this.config.villageProbability;
  }

  private getSettlementSpacing(settlementType: string): number {
    return settlementType === 'city' 
      ? this.config.settlementSpacing * 2 
      : this.config.settlementSpacing;
  }

  /**
   * Simple hash function for deterministic pseudo-random values
   */
  private simpleHash(x: number, y: number, extra = ''): number {
    let hash = 0;
    const str = `${x},${y},${extra}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Check if a location is suitable for settlement placement (not too close to others)
   */
  private isLocationSuitableForSettlement(x: number, y: number, minDistance: number): boolean {
    // For now, use a simple grid-based approach
    // In a real implementation, you might want to check the database
    const gridSize = minDistance;
    const gridX = Math.floor(x / gridSize) * gridSize;
    const gridY = Math.floor(y / gridSize) * gridSize;
    
    // Only allow one settlement per grid cell
    return x === gridX + Math.floor(gridSize / 2) && y === gridY + Math.floor(gridSize / 2);
  }

  /**
   * Get a natural biome alternative when settlements can't be placed
   */
  private getNaturalBiomeAlternative(terrain: TerrainData): string {
    // Find the best matching natural biome by re-evaluating terrain without settlements
    return BiomeMapper.getBiome(terrain) || 'plains';
  }

  /**
   * Cache operations - unified for better DRY
   */
  private async getCachedData<T>(cacheKey: string, errorMessage: string): Promise<T | null> {
    return this.handleAsync(
      () => redis.get(cacheKey).then(data => data ? JSON.parse(data) : null),
      errorMessage
    );
  }

  private async setCachedData<T>(cacheKey: string, ttl: number, data: T, errorMessage: string): Promise<void> {
    await this.handleAsync(
      () => redis.setEx(cacheKey, ttl, JSON.stringify(data)),
      errorMessage
    );
  }

  private async getTileFromCache(x: number, y: number): Promise<WorldTile | null> {
    const cacheKey = ChunkWorldGenerator.getCacheKey('tile', x, y);
    return this.getCachedData<WorldTile>(cacheKey, 'Error getting tile from cache');
  }

  private async cacheTile(tile: WorldTile): Promise<void> {
    const cacheKey = ChunkWorldGenerator.getCacheKey('tile', tile.x, tile.y);
    await this.setCachedData(cacheKey, ChunkWorldGenerator.TILE_CACHE_TTL, tile, 'Error caching tile');
  }

  /**
   * Database operations - unified storage methods
   */
  private async storeTileAsync(tile: WorldTile): Promise<void> {
    const stored = await this.performDatabaseOperation(
      () => prisma.worldTile.create({
        data: {
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
      await this.cacheTile(updatedTile);
    }
  }

  private async storeChunkAsync(chunk: WorldChunk): Promise<void> {
    const tilesToStore = chunk.tiles.filter(tile => tile.id === 0);
    
    await this.performDatabaseOperation(
      () => Promise.all(tilesToStore.map(tile => this.storeTileAsync(tile))),
      'Error storing chunk to database'
    );
  }
}
