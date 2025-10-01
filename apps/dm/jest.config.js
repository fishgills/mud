module.exports = {
  displayName: 'dm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', { ...require('../../jest.swc.config.cjs'), swcrc: false }],
  },
  transformIgnorePatterns: ['node_modules/(?!(graphql-request)/)'],
  moduleNameMapper: {
    '^@mud/constants$': '<rootDir>/../../libs/constants/src/constants.ts',
    '^@mud/database$': '<rootDir>/../../libs/database/src/index.ts',
    '^@mud/gcp-auth$': '<rootDir>/../../libs/gcp-auth/src/gcp-auth.ts',
    '^@mud/(.*)$': '<rootDir>/../../libs/$1/src',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
