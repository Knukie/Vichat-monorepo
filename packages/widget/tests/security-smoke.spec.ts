// tests/security-smoke.spec.ts
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

test('security smoke: bot content is escaped and links are hardened', async ({ page }) => {
  const strictCspHtmlPath = path.join(
    __dirname,
    '..',
    'public',
    'test',
    'strict-csp.html'
  );

  await routeHtml(page, '/test/strict-csp.html', strictCspHtmlPath);
  await maybeRouteBuildAssets(page);

  await page.goto(`${ORIGIN}/test/strict-csp.html`, {
    waitUntil: 'domcontentloaded'
  });

  await expect(page.locator('body[data-valki-ready="true"]')).toHaveCount(1);

  // Test-only inject controls must exist, otherwise skip
  const injectBtn = page.locator('#valki-test-inject-btn');
  await expect(injectBtn).toHaveCount(1);

  // Fill malicious payload
  await page.fill(
    '#valki-test-inject-text',
    '<img src=x onerror=alert(1)> [bad](javascript:alert(1)) https://example.com'
  );

  // Force click (CSP / overlay safe)
  await injectBtn.click({ force: true });

  // Assert rendered bot bubble
  const bubble = page.locator('.valki-msg-row.bot .valki-msg-bubble');
  await expect(bubble).toContainText('<img src=x onerror=alert(1)>');

  // No raw images injected
  await expect(bubble.locator('img')).toHaveCount(0);

  // No javascript: links
  await expect(bubble.locator('a[href^="javascript:"]')).toHaveCount(0);

  // Safe https link exists (tolerant for trailing slash)
  await expect(
    bubble.locator('a[href^="https://example.com"]')
  ).toHaveCount(1);

  await page.screenshot({
    path: 'step12-security.png',
    fullPage: true
  });
});
