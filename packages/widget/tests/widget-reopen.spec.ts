import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = process.env.BASE_URL || 'http://localhost:3000';

async function routeHtml(page: any, urlPath: string, filePath: string) {
  const html = await fs.readFile(filePath, 'utf8');
  await page.route(`**${urlPath}`, async (route: any) => {
    await route.fulfill({
      status: 200,
      body: html,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  });
}

test('widget reopens after close for guest and authenticated flows', async ({ page }) => {
  const strictCspHtmlPath = path.join(__dirname, '..', 'public', 'test', 'strict-csp.html');
  await routeHtml(page, '/test/strict-csp.html', strictCspHtmlPath);
  await maybeRouteBuildAssets(page);

  await page.goto(`${ORIGIN}/test/strict-csp.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body[data-valki-ready="true"]')).toHaveCount(1);

  await page.route('**/api/me', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ loggedIn: true, user: { displayName: 'Auth User' } }),
      headers: { 'content-type': 'application/json' }
    });
  });

  await page.route('**/api/messages**', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ messages: [] }),
      headers: { 'content-type': 'application/json' }
    });
  });

  await page.route('**/api/valki**', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ reply: 'ok' }),
      headers: { 'content-type': 'application/json' }
    });
  });

  const bubble = page.locator('#valki-bubble');
  await bubble.click();

  const input = page.locator('#valki-chat-input');
  await expect(input).toBeVisible();
  await input.fill('guest hello');
  await input.press('Enter');
  await expect(page.locator('.valki-msg-row.bot .valki-msg-bubble').filter({ hasText: 'ok' })).toBeVisible();

  await page.locator('#valki-close').click();
  await expect(page.locator('#valki-overlay')).toHaveAttribute('aria-hidden', 'true');

  await bubble.click();
  await expect(input).toBeVisible();
  await input.fill('guest reopen');
  await input.press('Enter');
  await expect(page.locator('.valki-msg-row.bot .valki-msg-bubble').filter({ hasText: 'ok' })).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem('valki_auth_token_v1', 'token');
  });

  await page.locator('#valki-close').click();
  await bubble.click();
  await expect(input).toBeVisible();
  await input.fill('auth reopen');
  await input.press('Enter');
  await expect(page.locator('.valki-msg-row.bot .valki-msg-bubble').filter({ hasText: 'ok' })).toBeVisible();
});
