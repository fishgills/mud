const baseConfig = require('../../jest.base.config.cjs');

module.exports = {
  ...baseConfig,
  displayName: '@mud/redis-client',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
