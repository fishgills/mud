import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
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
];
