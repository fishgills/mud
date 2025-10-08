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
  moduleNameMapper: {
    '^@mud/engine$': '<rootDir>/../../test/jest/mocks/mud-engine.ts',
    '^@mud/engine/(.*)$': '<rootDir>/../../test/jest/mocks/mud-engine.ts',
    '^@mud/gcp-auth$': '<rootDir>/../../test/jest/mocks/mud-gcp-auth.ts',
    '^@mud/gcp-auth/(.*)$': '<rootDir>/../../test/jest/mocks/mud-gcp-auth.ts',
    '^@mud/constants$': '<rootDir>/../../libs/constants/src/constants.ts',
    '^@mud/constants/(.*)$': '<rootDir>/../../libs/constants/src/$1.ts',
    '^@mud/(.*)$': '<rootDir>/../../libs/$1/src',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  collectCoverage: true,
  coverageReporters: ['text-summary', 'lcov', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  // Prevent Jest from hanging on open handles
  testTimeout: 10000,
};
