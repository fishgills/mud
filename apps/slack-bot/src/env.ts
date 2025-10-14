import { cleanEnv, str, url } from 'envalid';
import dotenv from 'dotenv';
dotenv.config();

export const env = cleanEnv(process.env, {
  SLACK_BOT_TOKEN: str(),
  SLACK_SIGNING_SECRET: str(),
  SLACK_APP_TOKEN: str(),
  DM_API_BASE_URL: url({ default: 'http://localhost:3000' }),
  WORLD_API_BASE_URL: url({ default: 'http://closet.battleforge.app/world' }),
  REDIS_URL: url({ default: 'redis://localhost:6379' }),
  PORT: str({ default: '3002' }),
});
