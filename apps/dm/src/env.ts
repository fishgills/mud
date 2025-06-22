import { cleanEnv, str, url } from 'envalid';

export const env = cleanEnv(process.env, {
  OPENAI_API_KEY: str(),
  DATABASE_URL: str(),
  WORLD_SERVICE_URL: url({ default: 'http://localhost:3000/api' }),
});
