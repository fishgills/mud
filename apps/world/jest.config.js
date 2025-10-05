import baseConfig from '../../jest.base.config.cjs';

export default {
  ...baseConfig,
  displayName: 'world',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
  globalTeardown: '<rootDir>/jest.teardown.ts',
};
