import baseConfig from '../../jest.base.config.cjs';

export default {
  ...baseConfig,
  displayName: '@mud/engine',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
