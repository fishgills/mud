import { expect, test } from '@playwright/test';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/www';
const normalizedBasePath = basePath && basePath !== '/' ? basePath : '';
const withBasePath = (href: string) =>
  normalizedBasePath ? `${normalizedBasePath}${href}` : href;

test('home page has required links', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'BattleForge', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'BattleForge is a multiplayer text adventure game designed to be played directly inside Slack through private messages.',
    ),
  ).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Site' });
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(nav.getByRole('link', { name: 'Character' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Privacy' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Terms' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Support' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'About' })).toBeVisible();

  await expect(
    page.getByRole('link', { name: 'Sign in with Slack' }),
  ).toHaveAttribute('href', withBasePath('/api/auth/slack/start'));
});

test('character page prompts sign in when unauthenticated', async ({
  page,
}) => {
  await page.goto('/me');

  await expect(page).toHaveTitle('BattleForge | Character');
  await expect(
    page.getByRole('heading', { name: 'Your Character', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('You are not signed in.')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Sign in with Slack' }),
  ).toHaveAttribute('href', withBasePath('/api/auth/slack/start'));
  await expect(
    page.getByRole('link', { name: 'Character', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('terms page provides terms', async ({ page }) => {
  await page.goto('/terms');

  await expect(page).toHaveTitle('BattleForge | Terms of Service');
  await expect(
    page.getByRole('heading', { name: 'Terms of Service', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'BattleForge is provided as-is for entertainment and experimentation in Slack.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Terms', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('privacy page lists data handling details', async ({ page }) => {
  await page.goto('/privacy');

  await expect(page).toHaveTitle('BattleForge | Privacy Policy');
  await expect(
    page.getByRole('heading', { name: 'Privacy Policy', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '1. What Data We Collect', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: '2. What We Do NOT Collect',
      level: 2,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '3. How Messages Are Used', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '4. Data Retention', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '5. Data Deletion', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '6. Contact', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'support@battleforge.app' }),
  ).toHaveAttribute('href', 'mailto:support@battleforge.app');
  await expect(
    page.getByRole('link', { name: 'Privacy', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('support page provides contact details', async ({ page }) => {
  await page.goto('/support');

  await expect(page).toHaveTitle('BattleForge | Support');
  await expect(
    page.getByRole('heading', { name: 'Support', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'support@battleforge.app' }),
  ).toHaveAttribute('href', 'mailto:support@battleforge.app');
  await expect(
    page.getByRole('link', { name: 'Support', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('about page explains the project', async ({ page }) => {
  await page.goto('/about');

  await expect(page).toHaveTitle('BattleForge | About');
  await expect(
    page.getByRole('heading', { name: 'About', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'BattleForge is a multiplayer text adventure game that runs inside Slack DMs.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'About', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});
