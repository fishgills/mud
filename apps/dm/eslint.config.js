import { config } from '@mud/eslint-config';

/** @type {import("eslint").Linter.Config | import("eslint").Linter.FlatConfigArray} */
const testOverride = {
  files: ['**/*.spec.ts', '**/__tests__/**', '**/test/**'],
  rules: {
    // Tests commonly use loose typing for mocks and fixtures
    '@typescript-eslint/no-explicit-any': 'off',
    // Tests sometimes require CommonJS requires or legacy patterns
    '@typescript-eslint/no-require-imports': 'off',
  },
};

let local;
if (Array.isArray(config)) {
  // config is a FlatConfigArray
  local = [...config, testOverride];
} else {
  local = {
    ...config,
    overrides: [...(config.overrides || []), testOverride],
  };
}

export default local;
