import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(REDIS_URL, {
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error('Redis error:', err);
});

// Cache keys
export const CACHE_KEYS = {
  TILE: (x: number, y: number) => `tile:${x}:${y}`,
  CHUNK: (chunkX: number, chunkY: number) => `chunk:${chunkX}:${chunkY}`,
  STATS: 'world:stats',
  BIOME_COUNT: 'biome:count',
};

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  TILE: 3600, // 1 hour
  CHUNK: 1800, // 30 minutes
  STATS: 300, // 5 minutes
};
