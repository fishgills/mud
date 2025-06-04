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

  // In-memory cache for biome IDs
  private static biomeIdCache: Map<string, number> = new Map();

  static async createTileFromBiome(
    x: number,
    y: number,
    biomeName: string
  ): Promise<WorldTile> {
    let biomeId = DRYTileUtils.biomeIdCache.get(biomeName);
    if (biomeId === undefined) {
      const biome = await prisma.biome.findUnique({
        where: { name: biomeName },
      });
      if (!biome) {
        throw new Error(`Biome not found: ${biomeName}`);
      }
      biomeId = biome.id;
      DRYTileUtils.biomeIdCache.set(biomeName, biomeId);
    }
    return {
      id: 0,
      x,
      y,
      biomeId,
      description: `You are in a ${biomeName} at (${x}, ${y}).`,
    };
  }
}
