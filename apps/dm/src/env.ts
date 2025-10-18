import { config as loadDotenv } from 'dotenv';
import { cleanEnv, str, url, num } from 'envalid';

loadDotenv();

export const env = cleanEnv(process.env, {
  OPENAI_API_KEY: str({ devDefault: 'test-openai-key' }),
  DATABASE_URL: str({ devDefault: 'postgresql://localhost:5432/mud' }),
  WORLD_SERVICE_URL: url({ default: 'http://localhost:3000/world' }),
  REDIS_URL: url({ devDefault: 'redis://localhost:6379' }),
  COORDINATION_PREFIX: str({ default: 'dm:coord:' }),
  TILE_DESC_LOCK_TTL_MS: num({ default: 15_000 }),
  TILE_DESC_COOLDOWN_MS: num({ default: 300_000 }),
  TILE_DESC_MIN_RETRY_MS: num({ default: 30_000 }),
  // Movement / tick scaling controls
  MOVEMENT_ACTIVE_RADIUS: num({ default: 50 }),
  MOVEMENT_PARTITIONS: num({ default: 4 }),
  MOVEMENT_CONCURRENCY: num({ default: 25 }),
  MOVEMENT_CHANCE: num({ default: 0.4 }),
  MOVEMENT_BUDGET: num({ default: 1000 }),
});
