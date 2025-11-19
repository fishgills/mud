import { config as loadDotenv } from 'dotenv';
import { cleanEnv, str, url, num, port, makeValidator } from 'envalid';

loadDotenv();

const boolFlexible = makeValidator<boolean>((input) => {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  throw new Error('Invalid boolean value');
});

const buildEnv = () => {
  const fallbackProject =
    process.env.GCP_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
  const fallbackRegion =
    process.env.GCP_REGION ?? process.env.GOOGLE_CLOUD_REGION ?? '';

  return cleanEnv(process.env, {
    OPENAI_API_KEY: str({ devDefault: 'test-openai-key' }),
    DATABASE_URL: str({ devDefault: 'postgresql://localhost:5432/mud' }),
    WORLD_SERVICE_URL: url({ default: 'https://closet.battleforge.app/world' }),
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
    DM_USE_VERTEX_AI: boolFlexible({ default: false }),
    ACTIVE_PLAYER_WINDOW_MINUTES: num({ default: 30 }),
    SPAWN_COOLDOWN_TICKS: num({ default: 3 }),
    GCP_PROJECT_ID: str({ default: fallbackProject }),
    GCP_REGION: str({ default: fallbackRegion }),
    PORT: port({ default: 3000 }),
    DM_OPENAI_CACHE_TTL_MS: num({ default: 300_000 }),
    DM_OPENAI_CACHE_MAX: num({ default: 200 }),
    DM_OPENAI_TIMEOUT_MS: num({ default: 800 }),
    GUILD_TELEPORT_COOLDOWN: num({ default: 300 }),
    GUILD_POPULATION_LIMIT: num({ default: 50 }),
    GUILD_SHOP_ROTATION_SIZE: num({ default: 6 }),
    GUILD_SHOP_ROTATION_INTERVAL_MS: num({
      default: 5 * 60 * 1000,
    }),
  });
};

export type Env = ReturnType<typeof buildEnv>;

let currentEnv = buildEnv();
export let env: Env = currentEnv;

export const refreshEnv = (): Env => {
  currentEnv = buildEnv();
  env = currentEnv;
  return env;
};
