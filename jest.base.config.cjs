const swcJestConfig = {
  ...require('./jest.swc.config.cjs'),
  swcrc: false,
};

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // Prevent Jest from hanging on open handles
  testTimeout: 10000,
};
