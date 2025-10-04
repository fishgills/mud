import baseConfig from '../../eslint.config.mjs';
import tseslint from 'typescript-eslint';

/**
 * ESLint configuration for the database library
 *
 */
export default tseslint.config(
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Prisma-generated types can trigger false positives in strict type checking
    // Disable these rules for the database lib to prevent CI failures
    rules: {
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    // Exclude scripts directory (backfill scripts, utilities, etc.)
    ignores: ['scripts/**/*'],
  },
);
