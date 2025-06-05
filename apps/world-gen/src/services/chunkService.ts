// Chunk and tile generation, caching, and persistence logic
import Redis from 'ioredis';
import { getPrismaClient } from '@mud/database';
import { Biome } from '../logic/biome';
import { runChunkWorker } from './workerPool';
import { ChunkLogger } from '../utils/logging';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = getPrismaClient();

const CHUNK_SIZE = 50;
const WORLD_SEED = process.env.WORLD_SEED || 'default-seed';

export interface TileInfo {
  x: number;
  y: number;
  biome: Biome;
  temperature: number;
  moisture: number;
}

export async function getTile(
  x: number,
  y: number,
  logger?: ChunkLogger
): Promise<TileInfo> {
  const cacheKey = `tile:${x}:${y}`;
  // 1. Try Redis
  const cached = await redis.get(cacheKey);
  if (cached) {
    const tile = JSON.parse(cached);
    if (logger) logger.logTile(tile, 'redis');
    return tile;
  }

  // 2. Try DB
  const dbTile = await prisma.worldTile.findUnique({
    where: { x_y: { x, y } },
    include: { biome: true },
  });
  if (dbTile) {
    const tileInfo: TileInfo = {
      x: dbTile.x,
      y: dbTile.y,
      biome: dbTile.biomeName as Biome,
      temperature: dbTile.temperature,
      moisture: dbTile.moisture,
    };
    await redis.set(cacheKey, JSON.stringify(tileInfo));
    if (logger) logger.logTile(tileInfo, 'db');
    return tileInfo;
  }

  // 3. Generate (should not be called in chunk path)
  const tileInfo: TileInfo = {
    x,
    y,
    biome: 'plains',
    temperature: 0.5,
    moisture: 0.5,
  };
  if (logger) logger.logTile(tileInfo, 'generated');
  return tileInfo;
}

// Use worker threads for chunk generation

export async function getChunk(
  chunkX: number,
  chunkY: number
): Promise<TileInfo[][]> {
  const logger = new ChunkLogger();
  const flatTiles: TileInfo[] = await runChunkWorker(
    chunkX,
    chunkY,
    CHUNK_SIZE,
    WORLD_SEED
  );
  // For each tile, ensure it's cached and persisted (but don't block on it)
  await Promise.all(flatTiles.map((tile) => getTile(tile.x, tile.y, logger)));
  // Reshape to 2D array
  const tiles: TileInfo[][] = [];
  for (let dy = 0; dy < CHUNK_SIZE; dy++) {
    tiles.push(flatTiles.slice(dy * CHUNK_SIZE, (dy + 1) * CHUNK_SIZE));
  }
  const stats = logger.finish();
  // Optionally log to console
  console.log(`Chunk (${chunkX},${chunkY}) stats:`, stats);
  return tiles;
}
