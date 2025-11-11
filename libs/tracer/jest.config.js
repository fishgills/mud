import baseConfig from '../../jest.base.config.cjs';

export default {
  ...baseConfig,
  displayName: '@mud/tracer',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
