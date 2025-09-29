module.exports = {
  displayName: '@mud/tick',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', { ...require('../../jest.swc.config.cjs'), swcrc: false }],
  },
  transformIgnorePatterns: ['node_modules/(?!(graphql-request)/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
