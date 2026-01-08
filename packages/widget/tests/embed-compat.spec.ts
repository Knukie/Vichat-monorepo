import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page, type FrameLocator } from '@playwright/test';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// tests/ -> repo root is one level up, then /public/shell.html
const publicDir = path.join(__dirname, '..', 'public');
const shellPath = path.join(publicDir, 'shell.html');

const maybeRouteShell = async (page: Page) => {
  await page.route('**/public/shell.html*', async (route) => {
    try {
      const body = await fs.readFile(shellPath);
      await route.fulfill({
        status: 200,
        body,
        headers: { 'content-type': 'text/html' }
      });
    } catch {
      await route.continue();
    }
  });
};

const openShadowWidget = async (page: Page) => {
  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const input = page.locator('#valki-chat-input');
  await expect(input).toBeVisible();
  await input.fill('Embed compatibility test');
  await input.press('Enter');

  const userMessage = page.locator('.valki-msg-row.user .valki-msg-bubble').filter({
    hasText: 'Embed compatibility test'
  });
  await expect(userMessage).toBeVisible();
};

const openIframeWidget = async (frameLocator: FrameLocator) => {
  const badge = frameLocator.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const input = frameLocator.locator('#valki-chat-input');
  await expect(input).toBeVisible();
  await input.fill('Embed compatibility test');
  await input.press('Enter');

  const userMessage = frameLocator.locator('.valki-msg-row.user .valki-msg-bubble').filter({
    hasText: 'Embed compatibility test'
  });
  await expect(userMessage).toBeVisible();
};

test('embed host 1 strict csp', async ({ page }) => {
  const pageUrl = new URL('/test/hosts/host1-strict-csp.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await maybeRouteShell(page);
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  await openShadowWidget(page);
  await page.screenshot({ path: 'embed-host1.png', fullPage: true });
});

test('embed host 2 css hostile', async ({ page }) => {
  const pageUrl = new URL('/test/hosts/host2-css-hostile.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await maybeRouteShell(page);
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  await openShadowWidget(page);
  await page.screenshot({ path: 'embed-host2.png', fullPage: true });
});

test('embed host 3 z-index war', async ({ page }) => {
  const pageUrl = new URL('/test/hosts/host3-zindex-war.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await maybeRouteShell(page);
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  await openShadowWidget(page);
  await page.screenshot({ path: 'embed-host3.png', fullPage: true });
});

test('embed host 4 iframe sandbox', async ({ page }) => {
  const pageUrl = new URL('/test/hosts/host4-iframe-sandbox.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await maybeRouteShell(page);
  await page.goto(pageUrl, { waitUntil: 'networkidle' });

  const sandboxFrame = page.frameLocator('#sandbox-frame');
  await openIframeWidget(sandboxFrame);
  await page.screenshot({ path: 'embed-host4.png', fullPage: true });
});
