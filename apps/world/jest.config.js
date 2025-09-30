/* eslint-disable */
const swcJestConfig = {
  ...require('../../jest.swc.config.cjs'),
  swcrc: false,
};

module.exports = {
  displayName: 'world',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/(?!(graphql-request)/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
