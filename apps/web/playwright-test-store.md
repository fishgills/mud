# Playwright Store Testing Guide

## Test Authentication Endpoint

For testing the store page without Slack OAuth, use the test authentication endpoint:

**Endpoint**: `https://closet.battleforge.app/www/api/auth/test/login`

**Features**:

- Only works in development mode (disabled in production)
- Creates a test player with:
  - Name: "Test Hero"
  - Level: 10
  - Gold: 10,000
  - Position: Guild HQ (0,0)
- Sets session cookie automatically
- Redirects to `/me/store` by default

## Usage with Playwright

### Basic Usage

```typescript
// Navigate to test auth endpoint, which will redirect to the store
await page.goto('https://closet.battleforge.app/www/api/auth/test/login');

// You should now be authenticated and viewing the store
await page.waitForURL('**/me/store');
```

### Custom Redirect

```typescript
// Redirect to inventory page after auth
await page.goto('https://closet.battleforge.app/www/api/auth/test/login?redirect=/me/inventory');
```

### Example Test Flow

```typescript
import { test, expect } from '@playwright/test';

test('store displays 7-13 items with rarity', async ({ page }) => {
  // Authenticate using test endpoint
  await page.goto('https://closet.battleforge.app/www/api/auth/test/login');

  // Verify we're on the store page
  await expect(page).toHaveURL(/\/me\/store$/);

  // Check that store header is visible
  await expect(page.getByRole('heading', { name: 'Guild Store' })).toBeVisible();

  // Verify gold amount is displayed (should be 10,000)
  await expect(page.getByText(/Gold 10000/i)).toBeVisible();

  // Verify player is in HQ (required to trade)
  await expect(page.getByText(/In HQ/i)).toBeVisible();

  // Verify rotation message
  await expect(page.getByText(/Rotates on tick events/i)).toBeVisible();

  // Check that catalog items are displayed
  // Note: Count may vary between 7-13 items depending on rotation
  const catalogItems = page.locator('[data-testid="catalog-item"]'); // You may need to add this data-testid
  const count = await catalogItems.count();
  expect(count).toBeGreaterThanOrEqual(7);
  expect(count).toBeLessThanOrEqual(13);
});
```

## Test Player Details

- **Team ID**: `T_TEST_TEAM`
- **User ID**: `U_TEST_USER`
- **Player Name**: `Test Hero`
- **Starting Gold**: 10,000
- **Starting Level**: 10
- **Location**: Guild HQ (0, 0)

## Notes

- The test endpoint is **disabled in production** for security
- The test player is created once and reused on subsequent calls
- Session cookie is valid for 30 days
- All test data uses the `T_TEST_TEAM` team ID to keep test data separate
