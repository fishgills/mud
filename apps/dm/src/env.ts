import { cleanEnv, str, url } from 'envalid';

export const env = cleanEnv(process.env, {
  OPENAI_API_KEY: str(),
  WORLD_SERVICE_URL: url({ default: 'http://localhost:3001/api' }),
});
