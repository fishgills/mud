import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';
/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  globalIgnores([
    'dist/**',
    'node_modules/**',
    '**/generated/**',
    '**/src/generated/**',
    '**/codegen.ts',
  ]),
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
    },
  },
  {
    ignores: ['dist/**'],
  },
];

// // import eslint from '@eslint/js';
// // import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
// // import globals from 'globals';
// // import tseslint from 'typescript-eslint';
// import { defineConfig, globalIgnores } from 'eslint/config';
// import { config } from '@mud/eslint-config';

// export default defineConfig([
//   globalIgnores([
//     '**/dist/**',
//     '**/generated/**',
//     '**/src/generated/**',
//     '**/codegen.ts',
//   ]),
//   config,
// ]);
// //   eslint.configs.recommended,
// //   ...tseslint.configs.recommendedTypeChecked,
// //   eslintPluginPrettierRecommended,
// //   {
// //     languageOptions: {
// //       globals: {
// //         ...globals.node,
// //         ...globals.jest,
// //       },
// //       sourceType: 'commonjs',
// //       parserOptions: {
// //         project: true,
// //         tsconfigRootDir: import.meta.dirname,
// //       },
// //     },
// //   },
// //   // Disable TypeScript type-checking rules for JavaScript and module files
// //   {
// //     files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
// //     extends: [tseslint.configs.disableTypeChecked],
// //     rules: {
// //       '@typescript-eslint/no-require-imports': 'off',
// //     },
// //   },
// //   // Disable TypeScript type-checking rules for test files
// //   {
// //     files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
// //     extends: [tseslint.configs.disableTypeChecked],
// //     rules: {
// //       '@typescript-eslint/no-explicit-any': 'off',
// //       '@typescript-eslint/no-unsafe-assignment': 'off',
// //       '@typescript-eslint/no-unsafe-call': 'off',
// //       '@typescript-eslint/no-unsafe-member-access': 'off',
// //       '@typescript-eslint/no-unsafe-return': 'off',
// //       '@typescript-eslint/no-unsafe-argument': 'off',
// //       '@typescript-eslint/no-require-imports': 'off',
// //     },
// //   },
// // ]);
