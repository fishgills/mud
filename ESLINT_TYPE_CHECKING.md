# ESLint TypeScript Type Checking Configuration

## Problem

Local ESLint linting was not catching TypeScript type errors that GitHub Actions was catching. This created a confusing development experience where code would pass locally but fail in CI.

## Root Cause

The base ESLint configuration was using `parserOptions.projectService` which doesn't reliably find TypeScript projects in a monorepo structure. GitHub Actions may have been using a different resolution strategy or caching behavior that made it work there.

## Solution

### 1. Updated Base Configuration

Changed `/eslint.config.mjs` from:
```javascript
parserOptions: {
  projectService: {
    allowDefaultProject: ['*.js', '*.mjs', '*.cjs'],
  },
  tsconfigRootDir: import.meta.dirname,
}
```

To:
```javascript
parserOptions: {
  project: true,
  tsconfigRootDir: import.meta.dirname,
}
```

### 2. Added Explicit Project Configuration to Libraries

For libraries with TypeScript code that should be type-checked (`@mud/redis-client`, `@mud/database`), added explicit project configuration:

```javascript
import tseslint from 'typescript-eslint';

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
    ignores: ['**/*.spec.ts'], // Test files use disableTypeChecked from base config
  },
);
```

## Key Changes

### `/eslint.config.mjs` (Base Configuration)
- Changed from `projectService` to `project: true`
- Keeps `recommendedTypeChecked` rules enabled
- Test files still have type checking disabled for flexibility

### `/libs/redis-client/eslint.config.mjs`
- Added explicit `project: './tsconfig.json'` for `src/**/*.ts` files
- Uses `tseslint.config()` wrapper for proper type checking setup
- Excludes `**/*.spec.ts` from strict type checking

### `/libs/database/eslint.config.mjs`
- Added explicit `project: './tsconfig.json'` for `src/**/*.ts` files
- Uses `tseslint.config()` wrapper
- Keeps Prisma-specific rule exceptions
- Excludes `scripts/**/*` (backfill scripts, utilities)

## Type-Checked Rules Now Enforced Locally

These `@typescript-eslint` rules now work consistently between local and CI:

- ✅ `@typescript-eslint/no-unsafe-assignment` - Prevents assigning `any` or `error` typed values
- ✅ `@typescript-eslint/no-unsafe-member-access` - Prevents accessing properties on `any`/`error` types
- ✅ `@typescript-eslint/no-unsafe-call` - Prevents calling functions typed as `any`
- ✅ `@typescript-eslint/no-unsafe-return` - Prevents returning `any` typed values
- ✅ `@typescript-eslint/no-unsafe-argument` - Prevents passing `any` typed arguments

## Error Patterns Caught

### Before (Not Caught Locally)
```typescript
try {
  // ...
} catch (error) {  // ❌ error is typed as 'any'
  console.log(error.message);  // ❌ Unsafe member access
}
```

### After (Caught Locally)
```typescript
try {
  // ...
} catch (error: unknown) {  // ✅ Explicitly typed
  if (error instanceof Error) {
    console.log(error.message);  // ✅ Type-safe
  } else {
    console.log(error);  // ✅ Safe fallback
  }
}
```

## Verification

Test that type checking works:

```bash
# Should pass with proper typing
yarn turbo lint

# Test with intentional error:
# Change `catch (error: unknown)` to `catch (error)` in any library
# Should fail with unsafe member access errors
```

## Benefits

1. **Consistency**: Local and CI environments now behave identically
2. **Early Detection**: Catch type errors during development, not in PR review
3. **Type Safety**: Enforces proper error handling and type guards
4. **Developer Experience**: No surprises when pushing to GitHub

## Excluded Files

Files excluded from strict type checking:
- `**/*.spec.ts` - Test files (base config disables type checking)
- `**/*.test.ts` - Test files
- `**/*.js` - JavaScript files
- `libs/database/scripts/**/*` - Utility scripts
- `**/dist/**` - Build output
- `**/generated/**` - Generated code

## NestJS Applications

NestJS apps (`dm`, `world`, `slack-bot`, `tick`) should also adopt this pattern if they need stricter type checking:

```javascript
// apps/dm/eslint.config.mjs
import baseConfig from '../../eslint.config.mjs';
import tseslint from 'typescript-eslint';

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
);
```

## Troubleshooting

### "File not found in project"
- Ensure the file is included in `tsconfig.json` → `"include"` array
- Check that file pattern in ESLint config matches actual file locations
- Use `ignores` to exclude files not in TypeScript project

### Slow Linting
- Type-checked linting is slower than non-type-checked
- Use `--filter` to lint specific packages during development
- CI parallelizes across packages automatically

### False Positives with Prisma
- Add rule exceptions in package-specific ESLint config
- See `libs/database/eslint.config.mjs` for example

## References

- [typescript-eslint - Type-Aware Linting](https://typescript-eslint.io/getting-started/typed-linting)
- [ESLint v9 - Configuration](https://eslint.org/docs/latest/use/configure/)
- [TypeScript ESLint - Project Service](https://typescript-eslint.io/packages/parser#project)
