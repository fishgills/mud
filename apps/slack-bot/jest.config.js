import baseConfig from '../../jest.base.config.cjs';

export default {
  ...baseConfig,
  displayName: 'slack-bot',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/env.ts',
    '!src/generated/**',
    '!src/graphql/**',
    '!src/gql-client.ts',
    '!src/assets/**',
    '!src/handlers/stats/**',
  ],
};
