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

test('wraps widget mount in a host container', async ({ page }) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'test', 'strict-csp.html');
  await routeHtml(page, '/test/strict-csp.html', htmlPath);
  await maybeRouteBuildAssets(page);

  await page.goto(`${ORIGIN}/test/strict-csp.html`, { waitUntil: 'domcontentloaded' });

  const host = page.locator('.widget-host[data-widget-provider="valki-vichat"]');
  await expect(host).toHaveCount(1);
  await expect(host).toHaveAttribute('data-widget-type', 'chat');
  await expect(host).toHaveAttribute('data-widget-placement', 'floating');

  const isWrapped = await page.evaluate(() => {
    const root = document.getElementById('valki-root');
    return Boolean(root?.parentElement?.classList.contains('widget-host'));
  });

  expect(isWrapped).toBe(true);
});
