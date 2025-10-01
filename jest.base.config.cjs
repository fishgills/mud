const swcJestConfig = {
  ...require('./jest.swc.config.cjs'),
  swcrc: false,
};

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/(?!(graphql-request)/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  collectCoverage: true,
  coverageReporters: ['text-summary', 'lcov', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // Prevent Jest from hanging on open handles
  testTimeout: 10000,
};
