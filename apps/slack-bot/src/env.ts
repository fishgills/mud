import { cleanEnv, str, url } from 'envalid';
import dotenv from 'dotenv';
dotenv.config();

export const env = cleanEnv(process.env, {
  SLACK_BOT_TOKEN: str(),
  SLACK_SIGNING_SECRET: str(),
  SLACK_APP_TOKEN: str(),
  DM_GQL_ENDPOINT: url({ default: 'http://localhost:3001/graphql' }),
  WORLD_GQL_ENDPOINT: url({ default: 'http://localhost:3000/graphql' }),
  WORLD_BASE_URL: url({ default: 'http://localhost:3001/world' }),
  PORT: str({ default: '3002' }),
});
