# Character Existence Check Centralization

## Overview

Centralized the logic for checking if a character exists and providing friendly messaging when a user doesn't have a character yet. This eliminates duplicated error messages and provides a consistent, user-friendly experience across all handlers.

## What Was Created

### New File: `apps/slack/src/handlers/characterUtils.ts`

A new utility module that exports:

1. **`MISSING_CHARACTER_MESSAGE` constant**
   - Friendly message shown when a user doesn't have a character
   - Points users to use the "new" command to create a character
   - Used consistently across all handlers

2. **`requireCharacter()` function**
   - Centralized async function to verify a character exists
   - Returns the PlayerRecord if found, or null if not found
   - Automatically sends a friendly message via the `say` callback when character is missing
   - Supports custom error messages for handlers that need specific messaging

## Updated Handlers

### 1. **attack.ts**

- Added import of `requireCharacter`
- Replaced manual player lookup in the "selection" branch with `requireCharacter()`
- Removed inline error messaging for missing players
- Now consistently uses centralized messaging

### 2. **inspect.ts**

- Added import of `requireCharacter`
- Simplified the `perform()` method to use `requireCharacter()` at the start
- Removed manual player lookup and inline error handling
- Cleaner code flow with early returns

### 3. **inventory.ts**

- Added import of `MISSING_CHARACTER_MESSAGE` constant
- Removed hardcoded missing character message
- Now references the centralized constant

### 4. **stats/index.ts**

- Added import of `MISSING_CHARACTER_MESSAGE` constant
- Removed hardcoded `missingCharacterMessage` variable definition
- Updated all references to use the centralized constant
- Reduces code duplication across self-lookup and nearby-player lookup branches

## Benefits

✅ **Consistency**: All handlers now show the same friendly message when a user doesn't have a character
✅ **Maintainability**: Change the message once in `characterUtils.ts`, and it updates everywhere
✅ **DRY Principle**: Eliminated duplicated error handling and messaging logic
✅ **Reduced Code**: Less boilerplate in each handler
✅ **Friendly UX**: Users get helpful guidance (create command) in every missing-character scenario
✅ **Type Safety**: TypeScript ensures proper return types and null handling

## Usage Pattern

```typescript
// Before (scattered across multiple files):
if (!player) {
  await say({
    text: `You don't have a character yet! Use "${COMMANDS.NEW} CharacterName" to create one.`,
  });
  return;
}

// After (centralized):
const player = await requireCharacter(teamId, userId, say);
if (!player) return;
```

## Future Enhancement Opportunities

Additional handlers that could benefit from this pattern:

- `move.ts` - Could require character before processing movement
- `drop.ts` - Character check before dropping items
- `pickup.ts` - Character check before picking up items
- `equip.ts` / `unequip.ts` - Character checks for equipment management
- `sniff.ts` - Character check before sniffing for monsters
- Other command handlers following similar patterns

## Verification

✅ `@mud/slack` builds successfully with no errors
✅ `@mud/dm` builds successfully with no errors
✅ TypeScript compilation passes for all handler files
