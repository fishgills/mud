const baseConfig = require('../../jest.base.config.cjs');

module.exports = {
  ...baseConfig,
  displayName: 'world',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
  globalTeardown: '<rootDir>/jest.teardown.ts',
};
