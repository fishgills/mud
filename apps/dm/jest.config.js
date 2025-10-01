const baseConfig = require('../../jest.base.config.cjs');

module.exports = {
  ...baseConfig,
  displayName: 'dm',
  moduleNameMapper: {
    '^@mud/constants$': '<rootDir>/../../libs/constants/src/constants.ts',
    '^@mud/database$': '<rootDir>/../../libs/database/src/index.ts',
    '^@mud/gcp-auth$': '<rootDir>/../../libs/gcp-auth/src/gcp-auth.ts',
    '^@mud/(.*)$': '<rootDir>/../../libs/$1/src',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
