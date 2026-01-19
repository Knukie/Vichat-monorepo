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

async function mockReply(page: any) {
  await page.route('**/api/valki**', async (route: any) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ reply: 'ok' }),
      headers: { 'content-type': 'application/json' }
    });
  });
}

test('guest shows You in author label and Guest in header', async ({ page }) => {
  const strictCspHtmlPath = path.join(__dirname, '..', 'public', 'test', 'strict-csp.html');
  await routeHtml(page, '/test/strict-csp.html', strictCspHtmlPath);
  await maybeRouteBuildAssets(page);
  await mockReply(page);

  await page.goto(`${ORIGIN}/test/strict-csp.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body[data-valki-ready="true"]')).toHaveCount(1);

  const bubble = page.locator('#valki-bubble');
  await bubble.click();

  await expect(page.locator('#valki-session-label')).toHaveText('Guest 🟠');

  const input = page.locator('#valki-chat-input');
  await input.fill('guest hello');
  await input.press('Enter');

  await expect(page.locator('.valki-msg-row.user .valki-msg-author')).toHaveText('You');
});

test('authenticated user shows displayName in header and author label', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('valki_auth_token_v1', 'token');
  });

  const strictCspHtmlPath = path.join(__dirname, '..', 'public', 'test', 'strict-csp.html');
  await routeHtml(page, '/test/strict-csp.html', strictCspHtmlPath);
  await maybeRouteBuildAssets(page);
  await mockReply(page);

  await page.route('**/api/me', async (route: any) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ loggedIn: true, user: { displayName: 'Ada Lovelace' } }),
      headers: { 'content-type': 'application/json' }
    });
  });

  await page.route('**/api/messages**', async (route: any) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ messages: [] }),
      headers: { 'content-type': 'application/json' }
    });
  });

  await page.goto(`${ORIGIN}/test/strict-csp.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body[data-valki-ready="true"]')).toHaveCount(1);

  const bubble = page.locator('#valki-bubble');
  await bubble.click();

  await expect(page.locator('#valki-session-label')).toHaveText('Ada Lovelace 🟢');

  const input = page.locator('#valki-chat-input');
  await input.fill('auth hello');
  await input.press('Enter');

  await expect(page.locator('.valki-msg-row.user .valki-msg-author')).toHaveText('Ada Lovelace');
});
