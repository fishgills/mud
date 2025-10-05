import baseConfig from '../../jest.base.config.cjs';

export default {
  ...baseConfig,
  displayName: 'dm',
  moduleNameMapper: {
    '^@mud/constants$': '<rootDir>/../../libs/constants/src/constants.ts',
    '^@mud/database$': '<rootDir>/../../libs/database/src/index.ts',
    '^@mud/gcp-auth$': '<rootDir>/../../libs/gcp-auth/src/gcp-auth.ts',
    '^@mud/engine$': '<rootDir>/../../libs/engine/dist/index.js',
    '^@mud/engine/(.*)$': '<rootDir>/../../libs/engine/dist/$1',
    '^@mud/redis-client$':
      '<rootDir>/../../libs/redis-client/dist/redis-client.js',
    '^@mud/redis-client/(.*)$': '<rootDir>/../../libs/redis-client/dist/$1',
    '^@mud/(.*)$': '<rootDir>/../../libs/$1/src',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.{ts,js}'],
};
