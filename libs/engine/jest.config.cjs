module.exports = {
  displayName: '@mud/engine',
  preset: '../../jest.base.config.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': '@swc/jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/engine',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  passWithNoTests: true,
};
