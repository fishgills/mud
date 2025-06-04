import { BiomeMapper } from './biome-mapper';
import { WorldTile } from './world';
import prisma from '../prisma';
import redis from '../redis';

export class DRYTileUtils {
  static async getTileFromCache(
    x: number,
    y: number
  ): Promise<WorldTile | null> {
    const cacheKey = `tile:${x}:${y}`;
    const result = await redis.get(cacheKey);
    return result ? JSON.parse(result) : null;
  }

  static async cacheTile(tile: WorldTile): Promise<void> {
    const cacheKey = `tile:${tile.x}:${tile.y}`;
    await redis.set(cacheKey, JSON.stringify(tile), 'EX', 3600);
  }

  static async findExistingTile(
    x: number,
    y: number
  ): Promise<WorldTile | null> {
    const existingTile = await prisma.worldTile.findUnique({
      where: { x_y: { x, y } },
      include: { biome: true },
    });
    if (!existingTile) return null;
    return {
      id: existingTile.id,
      x: existingTile.x,
      y: existingTile.y,
      biomeId: existingTile.biomeId,
      description: existingTile.description,
    };
  }

  static determineBiome(
    terrain: import('./noise-generator').TerrainData
  ): string {
    return BiomeMapper.getBiome(terrain);
  }

  static async createTileFromBiome(
    x: number,
    y: number,
    biomeName: string
  ): Promise<WorldTile> {
    // This is a simplified version; in chunk-generator, this is async for DB
    return {
      id: 0,
      x,
      y,
      biomeId: 0, // Should be set properly if DB is used
      description: `You are in a ${biomeName} at (${x}, ${y}).`,
    };
  }
}
