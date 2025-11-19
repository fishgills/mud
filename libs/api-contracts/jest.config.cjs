const baseConfig = require('../../jest.base.config.cjs');

module.exports = {
  ...baseConfig,
  displayName: '@mud/api-contracts',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  collectCoverage: false,
};
