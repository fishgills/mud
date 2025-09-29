const swcJestConfig = {
  ...require('../../jest.swc.config.cjs'),
  swcrc: false,
};

module.exports = {
  displayName: 'slack-bot',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/(?!(graphql-request)/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
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
