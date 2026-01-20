// tests/widget.spec.ts
import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = process.env.BASE_URL || 'http://localhost:3000';

// We do NOT rely on a real server in CI. We fulfill the HTML via route().
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

test('strict csp chat flow', async ({ page }) => {
  const strictCspHtmlPath = path.join(__dirname, '..', 'public', 'test', 'strict-csp.html');
  await routeHtml(page, '/test/strict-csp.html', strictCspHtmlPath);
  await maybeRouteBuildAssets(page);

  await page.goto(`${ORIGIN}/test/strict-csp.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body[data-valki-ready="true"]')).toHaveCount(1);

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const agentHub = page.locator('#valki-agent-hub');
  if (await agentHub.isVisible()) {
    const firstAgent = page
      .locator(
        '#valki-agent-list button, #valki-agent-list [role="button"], #valki-agent-list .valki-agent-item, #valki-agent-list .valki-agent-card'
      )
      .first();
    if (await firstAgent.isVisible()) {
      await firstAgent.click();
    }
  }

  const input = page.locator('#valki-chat-input');
  await expect(input).toBeVisible({ timeout: 15000 });
  await input.fill('hello');
  await input.press('Enter');

  const botMessages = page.locator('.valki-msg-row.bot .valki-msg-bubble').filter({ hasText: /\S+/ });
  await expect(botMessages.first()).toBeVisible({ timeout: 30000 });

  await page.screenshot({ path: 'csp-chat-working.png', fullPage: true });
});

test('desktop hub selects agent and shows chat header', async ({ page }) => {
  const agentHubHtmlPath = path.join(__dirname, '..', 'public', 'test', 'agent-hub.html');
  await routeHtml(page, '/test/agent-hub.html', agentHubHtmlPath);
  await maybeRouteBuildAssets(page);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${ORIGIN}/test/agent-hub.html`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body[data-valki-ready="true"]')).toHaveCount(1);

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const dialog = page.locator('#valki-chat-shell[role="dialog"]');
  await expect(dialog).toHaveCount(1);
  await expect(dialog.locator('#valki-sidebar')).toHaveCount(1);
  await expect(page.locator('.valki-modal[role="dialog"]')).toHaveCount(0);

  const sidebar = page.locator('#valki-sidebar');
  await expect(sidebar).toBeVisible();

  const firstAgent = page.locator('#valki-agent-list .valki-agent-row').first();
  await expect(firstAgent).toBeVisible();
  const name = await firstAgent.locator('.valki-agent-name').innerText();
  await firstAgent.click();

  await expect(page.locator('#valki-title')).toHaveText(name);
  await expect(page.locator('#valki-chat-input')).toBeVisible();
});
