import { expect, test } from '@playwright/test';

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

  await expect(
    page.getByRole('link', { name: 'Privacy Policy' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Support' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'About' })).toBeVisible();
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
});
