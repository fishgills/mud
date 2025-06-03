import { NoiseGenerator, DEFAULT_WORLD_PARAMETERS, WorldParameters, TerrainData } from './noise-generator';
import { BiomeMapper } from './biome-mapper';
import { WorldTile } from './world';
import prisma from '../prisma';
import redis from '../redis';

export const CHUNK_SIZE = 20;

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
  private settlementSpacing: number;

  constructor(parameters: WorldParameters = DEFAULT_WORLD_PARAMETERS, settlementSpacing = 50) {
    this.noiseGenerator = new NoiseGenerator(parameters);
    this.settlementSpacing = settlementSpacing;
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
   * Generate a tile at specific world coordinates
   */
  async generateTile(x: number, y: number): Promise<WorldTile> {
    // Check cache first
    const cached = await this.getTileFromCache(x, y);
    if (cached) {
      return cached;
    }

    // Check if tile already exists in database
    const existingTile = await prisma.worldTile.findUnique({ 
      where: { x_y: { x, y } },
      include: { biome: true }
    });
    
    if (existingTile) {
      const tile: WorldTile = {
        id: existingTile.id,
        x: existingTile.x,
        y: existingTile.y,
        biomeId: existingTile.biomeId,
        description: existingTile.description,
        biomeMix: existingTile.biomeMix as Record<string, number> || undefined,
      };
      await this.cacheTile(tile);
      return tile;
    }

    // Generate new tile using noise-based generation
    const tile = await this.generateNewTile(x, y);
    
    // Cache the generated tile
    await this.cacheTile(tile);
    
    // Store in database asynchronously
    this.storeTileAsync(tile).catch(error => {
      console.error('Error storing tile async:', error);
    });
    
    return tile;
  }

  /**
   * Generate an entire chunk
   */
  async generateChunk(chunkX: number, chunkY: number): Promise<WorldChunk> {
    const cacheKey = `chunk:${chunkX}:${chunkY}`;
    
    // Check if chunk is cached
    try {
      const cachedChunk = await redis.get(cacheKey);
      if (cachedChunk) {
        return JSON.parse(cachedChunk);
      }
    } catch (error) {
      console.error('Error getting chunk from cache:', error);
    }

    // Generate terrain data for the entire chunk
    const terrainGrid = this.noiseGenerator.generateChunkTerrain(chunkX, chunkY, CHUNK_SIZE);
    
    const tiles: WorldTile[] = [];
    const { startX, startY } = ChunkWorldGenerator.chunkToWorld({ chunkX, chunkY });

    // Generate tiles for each position in the chunk
    for (let localX = 0; localX < CHUNK_SIZE; localX++) {
      for (let localY = 0; localY < CHUNK_SIZE; localY++) {
        const worldX = startX + localX;
        const worldY = startY + localY;
        const terrain = terrainGrid[localX][localY];
        
        // Determine base biome from terrain
        let biomeName = BiomeMapper.getBiome(terrain);
        
        // Apply settlement spacing rules
        if (BiomeMapper.isSettlement(biomeName)) {
          if (!this.shouldPlaceSettlement(worldX, worldY, biomeName)) {
            // Fall back to a natural biome based on terrain
            biomeName = this.getNaturalBiomeAlternative(terrain);
          }
        }

        // Get biome mix
        const biomeMix = BiomeMapper.getBiomeMix(terrainGrid, localX, localY);

        // Create tile
        const tile = await this.createTileFromBiome(worldX, worldY, biomeName, biomeMix);
        tiles.push(tile);
      }
    }

    const chunk: WorldChunk = {
      chunkX,
      chunkY,
      tiles,
      generatedAt: new Date()
    };

    // Cache the chunk
    try {
      await redis.setEx(cacheKey, 7200, JSON.stringify(chunk)); // Cache for 2 hours
    } catch (error) {
      console.error('Error caching chunk:', error);
    }

    // Store tiles in database asynchronously
    this.storeChunkAsync(chunk).catch(error => {
      console.error('Error storing chunk async:', error);
    });

    return chunk;
  }

  /**
   * Generate a new tile using noise-based generation
   */
  private async generateNewTile(x: number, y: number): Promise<WorldTile> {
    const terrain = this.noiseGenerator.generateTerrain(x, y);
    
    // Determine base biome
    let biomeName = BiomeMapper.getBiome(terrain);
    
    // Apply settlement spacing rules
    if (BiomeMapper.isSettlement(biomeName)) {
      if (!this.shouldPlaceSettlement(x, y, biomeName)) {
        biomeName = this.getNaturalBiomeAlternative(terrain);
      }
    }

    // For single tile generation, we need to sample nearby terrain for biome mix
    const biomeMix = await this.calculateBiomeMixForSingleTile(x, y);

    return this.createTileFromBiome(x, y, biomeName, biomeMix);
  }

  /**
   * Calculate biome mix for a single tile by sampling nearby terrain
   */
  private async calculateBiomeMixForSingleTile(x: number, y: number): Promise<Record<string, number>> {
    const biomeCounts: Record<string, number> = {};
    let totalSamples = 0;

    // Sample a 3x3 area around the tile
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sampleX = x + dx;
        const sampleY = y + dy;
        const terrain = this.noiseGenerator.generateTerrain(sampleX, sampleY);
        let biome = BiomeMapper.getBiome(terrain);
        
        // Don't place settlements in the mix calculation
        if (BiomeMapper.isSettlement(biome)) {
          biome = this.getNaturalBiomeAlternative(terrain);
        }
        
        biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;
        totalSamples++;
      }
    }

    // Convert to percentages
    const biomeMix: Record<string, number> = {};
    for (const [biome, count] of Object.entries(biomeCounts)) {
      biomeMix[biome] = Math.round((count / totalSamples) * 100) / 100;
    }

    return biomeMix;
  }

  /**
   * Create a WorldTile from biome information
   */
  private async createTileFromBiome(x: number, y: number, biomeName: string, biomeMix: Record<string, number>): Promise<WorldTile> {
    // Get or create biome
    let biome = await prisma.biome.findUnique({ where: { name: biomeName } });
    if (!biome) {
      // Create biome if it doesn't exist
      const biomeRule = BiomeMapper.getAllBiomes().find(name => name === biomeName);
      biome = await prisma.biome.create({
        data: {
          name: biomeName,
          description: biomeRule ? `A ${biomeName} biome.` : `Unknown biome: ${biomeName}`
        }
      });
    }

    const description = `You are in a ${biomeName} at (${x}, ${y}).`;

    return {
      id: 0, // Will be set when stored in database
      x,
      y,
      biomeId: biome.id,
      description,
      biomeMix,
    };
  }

  /**
   * Determine if a settlement should be placed at the given coordinates
   */
  private shouldPlaceSettlement(x: number, y: number, settlementType: string): boolean {
    // Use a deterministic pseudo-random approach based on coordinates
    const hash = this.simpleHash(x, y, settlementType);
    const probability = settlementType === 'city' ? 0.002 : 0.01; // Cities are rarer than villages
    
    // Check if this location should have a settlement based on spacing and probability
    if ((hash % 10000) / 10000 < probability) {
      // Check spacing constraints - no other settlements nearby
      const spacing = settlementType === 'city' ? this.settlementSpacing * 2 : this.settlementSpacing;
      return this.isLocationSuitableForSettlement(x, y, spacing);
    }
    
    return false;
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
   * Cache operations
   */
  private async getTileFromCache(x: number, y: number): Promise<WorldTile | null> {
    try {
      const cached = await redis.get(`tile:${x}:${y}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting tile from cache:', error);
      return null;
    }
  }

  private async cacheTile(tile: WorldTile): Promise<void> {
    try {
      await redis.setEx(`tile:${tile.x}:${tile.y}`, 3600, JSON.stringify(tile));
    } catch (error) {
      console.error('Error caching tile:', error);
    }
  }

  /**
   * Database operations
   */
  private async storeTileAsync(tile: WorldTile): Promise<void> {
    try {
      const stored = await prisma.worldTile.create({
        data: {
          x: tile.x,
          y: tile.y,
          biomeId: tile.biomeId,
          description: tile.description,
          biomeMix: tile.biomeMix,
        },
      });
      
      // Update cache with real ID
      const updatedTile = { ...tile, id: stored.id };
      await this.cacheTile(updatedTile);
    } catch (error) {
      console.error('Error storing tile to database:', error);
    }
  }

  private async storeChunkAsync(chunk: WorldChunk): Promise<void> {
    try {
      // Store all tiles in the chunk
      for (const tile of chunk.tiles) {
        if (tile.id === 0) { // Only store if not already in database
          await this.storeTileAsync(tile);
        }
      }
    } catch (error) {
      console.error('Error storing chunk to database:', error);
    }
  }
}
