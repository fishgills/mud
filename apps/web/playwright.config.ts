import { defineConfig } from '@playwright/test';

const port = '4000';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const normalizedBasePath =
  basePath && basePath !== '/' ? basePath.replace(/\/$/, '') : '';
const baseURL = `http://127.0.0.1:${port}${normalizedBasePath}`;
const webServerCommand = process.env.CI
  ? `yarn turbo build --filter=@mud/web... && yarn start -p ${port}`
  : 'yarn serve';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: normalizedBasePath
      ? { NEXT_PUBLIC_BASE_PATH: normalizedBasePath }
      : undefined,
  },
});
