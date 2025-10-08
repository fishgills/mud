import baseConfig from '../../jest.base.config.cjs';

export default {
  ...baseConfig,
  displayName: '@mud/engine',
  passWithNoTests: true,
  moduleNameMapper: {
    '^@mud/database$': '<rootDir>/src/test-utils/mud-database.ts',
  },
  resolver: '<rootDir>/jest.resolver.cjs',
};
