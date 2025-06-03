import redis from '../redis';
import { ChunkWorldGenerator } from './chunk-generator';
import { DEFAULT_WORLD_CONFIG } from './world-config';

// Create a global instance of the chunk world generator
const chunkGenerator = new ChunkWorldGenerator(DEFAULT_WORLD_CONFIG);

// Legacy biome size limits - kept for compatibility but may not be used in new system
export const BIOME_SIZE_LIMITS: Record<string, number> = {
  city: 5,
  village: 8,
  forest: 25,
  desert: 30,
  plains: 40,
  mountains: 20,
  hills: 15,
};

export interface WorldTile {
  id: number;
  x: number;
  y: number;
  biomeId: number;
  description: string;
  biomeMix?: Record<string, number>;
}

export async function getTileFromCache(x: number, y: number): Promise<WorldTile | null> {
  try {
    const cached = await redis.get(`tile:${x}:${y}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting tile from cache:', error);
    return null;
  }
}

export async function cacheTile(tile: WorldTile): Promise<void> {
  try {
    await redis.setEx(`tile:${tile.x}:${tile.y}`, 3600, JSON.stringify(tile)); // Cache for 1 hour
  } catch (error) {
    console.error('Error caching tile:', error);
  }
}

export async function generateTile(x: number, y: number): Promise<WorldTile> {
  // Use the new chunk-based generation system
  return await chunkGenerator.generateTile(x, y);
}

export async function generateTileGrid(centerX: number, centerY: number, radius: number): Promise<WorldTile[]> {
  const tiles: WorldTile[] = [];
  
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const x = centerX + dx;
      const y = centerY + dy;
      const tile = await generateTile(x, y);
      tiles.push(tile);
    }
  }
  
  return tiles;
}

/**
 * Generate a complete chunk (20x20 tiles) at once
 */
export async function generateChunk(chunkX: number, chunkY: number) {
  return await chunkGenerator.generateChunk(chunkX, chunkY);
}

/**
 * Get chunk coordinates from world coordinates
 */
export function worldToChunk(x: number, y: number) {
  return ChunkWorldGenerator.worldToChunk(x, y);
}

/**
 * Get world bounds from chunk coordinates
 */
export function chunkToWorld(chunkX: number, chunkY: number) {
  return ChunkWorldGenerator.chunkToWorld({ chunkX, chunkY });
}
