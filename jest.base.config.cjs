const swcJestConfig = {
  ...require('./jest.swc.config.cjs'),
  swcrc: false,
};

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // Transform ESM packages like @octokit
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|before-after-hook|universal-user-agent)/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    // Allow TS sources to use `.js` specifiers (for ESM builds) while letting Jest resolve `.ts` files.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverage: true,
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // Prevent Jest from hanging on open handles
  testTimeout: 10000,
};
