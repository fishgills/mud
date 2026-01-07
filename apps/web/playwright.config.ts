import { defineConfig } from '@playwright/test';

const port = '4000';
const baseURL = `http://127.0.0.1:${port}`;
const webServerCommand = process.env.CI
  ? `yarn build && yarn start -p ${port}`
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
  },
});
