import baseConfig from '../../jest.base.config.cjs';

export default {
  ...baseConfig,
  displayName: '@mud/redis-client',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
