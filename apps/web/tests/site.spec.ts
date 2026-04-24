import { expect, test } from '@playwright/test';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const normalizedBasePath =
  basePath && basePath !== '/' ? basePath.replace(/\/$/, '') : '';
const withBasePath = (href: string) =>
  normalizedBasePath ? `${normalizedBasePath}${href}` : href;

test('home page has required links', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(/BATTLEFORGE/)).toBeVisible();
  await expect(
    page.getByText('A multiplayer dungeon adventure played entirely in Slack DMs.'),
  ).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Site' });
  await expect(nav.getByRole('link', { name: 'HOME' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(nav.getByRole('link', { name: 'CHARACTER' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'STORE' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'PRIVACY' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'TERMS' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'SUPPORT' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'ABOUT' })).toBeVisible();

  await expect(
    page.getByRole('link', { name: 'SIGN IN' }).first(),
  ).toHaveAttribute('href', withBasePath('/api/auth/slack/start'));
});

test('character page prompts sign in when unauthenticated', async ({
  page,
}) => {
  await page.goto('/me');

  await expect(page).toHaveTitle('BattleForge | Character');
  await expect(page.getByText('CHARACTER')).toBeVisible();
  await expect(page.getByText('You are not signed in.')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'SIGN IN' }),
  ).toHaveAttribute('href', withBasePath('/api/auth/slack/start'));
  await expect(
    page.getByRole('link', { name: 'CHARACTER', exact: true }),
  ).toHaveCount(0);
});

test('store page prompts sign in when unauthenticated', async ({ page }) => {
  await page.goto('/me/store');

  await expect(page).toHaveTitle('BattleForge | Guild Store');
  await expect(page.getByText('GUILD STORE')).toBeVisible();
  await expect(page.getByText('You are not signed in.')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /SIGN IN/ }),
  ).toHaveAttribute('href', withBasePath('/api/auth/slack/start'));
  await expect(
    page.getByRole('link', { name: 'STORE', exact: true }),
  ).toHaveCount(0);
});

test('terms page provides terms', async ({ page }) => {
  await page.goto('/terms');

  await expect(page).toHaveTitle('BattleForge | Terms of Service');
  await expect(page.getByText('TERMS OF SERVICE')).toBeVisible();
  await expect(
    page.getByText(
      'BattleForge is provided as-is for entertainment and experimentation in Slack.',
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'TERMS', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('privacy page lists data handling details', async ({ page }) => {
  await page.goto('/privacy');

  await expect(page).toHaveTitle('BattleForge | Privacy Policy');
  await expect(page.getByText('PRIVACY POLICY')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '1. WHAT DATA WE COLLECT', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '2. WHAT WE DO NOT COLLECT', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '3. HOW MESSAGES ARE USED', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '4. DATA RETENTION', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '5. DATA DELETION', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '6. CONTACT', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'support@battleforge.app' }),
  ).toHaveAttribute('href', 'mailto:support@battleforge.app');
  await expect(
    page.getByRole('link', { name: 'PRIVACY', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('support page provides contact details', async ({ page }) => {
  await page.goto('/support');

  await expect(page).toHaveTitle('BattleForge | Support');
  await expect(page.getByText('SUPPORT')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'support@battleforge.app' }),
  ).toHaveAttribute('href', 'mailto:support@battleforge.app');
  await expect(
    page.getByRole('link', { name: 'SUPPORT', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('about page explains the project', async ({ page }) => {
  await page.goto('/about');

  await expect(page).toHaveTitle('BattleForge | About');
  await expect(page.getByText('ABOUT BATTLEFORGE')).toBeVisible();
  await expect(
    page.getByText('BattleForge is a multiplayer text adventure RPG', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ABOUT', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});
