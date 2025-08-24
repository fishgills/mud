import { cleanEnv, str, url, num, bool } from 'envalid';

export const env = cleanEnv(process.env, {
  DATABASE_URL: str(),
  REDIS_URL: url({ devDefault: 'redis://localhost:6379' }),
  CACHE_PREFIX: str({ default: 'world:render:' }),
  WORLD_RENDER_CACHE_TTL_MS: num({ default: 30000 }),
  WORLD_RENDER_COMPUTE_ON_THE_FLY: bool({ default: true }),
});
