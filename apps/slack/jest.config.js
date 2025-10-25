import baseConfig from '../../jest.base.config.cjs';

export default {
  ...baseConfig,
  displayName: 'slack-bot',
  setupFiles: [...(baseConfig.setupFiles ?? []), '<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/env.ts',
    '!src/dm-client.ts',
    '!src/assets/**',
    '!src/handlers/stats/**',
  ],
};
