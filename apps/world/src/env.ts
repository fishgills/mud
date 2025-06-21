import { cleanEnv, str } from 'envalid';

export const env = cleanEnv(process.env, {
  DATABASE_URL: str(),
});
