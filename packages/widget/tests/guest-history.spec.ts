import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = process.env.BASE_URL || 'http://localhost:3000';

const sampleImagePath = path.join(__dirname, '..', 'test', 'assets', 'sample.png');
const guestHistoryHtmlPath = path.join(__dirname, '..', 'test', 'guest-history.html');

const imageDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/woAAgMBAp0P2QAAAABJRU5ErkJggg==';

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

async function routeGuestApi(page: any) {
  await page.route('**/api/upload', async (route: any) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/uploaded.png',
        mime: 'image/png',
        name: 'uploaded.png',
        size: 1234
      })
    });
  });

  await page.route('**/api/valki', async (route: any) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reply: 'Guest reply' })
    });
  });

  await page.route('**/api/import-guest', async (route: any) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true })
    });
  });
}

async function waitForWidget(page: any) {
  await page.waitForFunction(() => window.__VICHAT_WIDGET__);
}

test('guest history persists text-only messages', async ({ page }) => {
  await routeHtml(page, '/test/guest-history.html', guestHistoryHtmlPath);
  await maybeRouteBuildAssets(page);
  await routeGuestApi(page);

  await page.goto(`${ORIGIN}/test/guest-history.html`, { waitUntil: 'domcontentloaded' });
  await waitForWidget(page);

  await page.evaluate(async () => {
    await window.__VICHAT_WIDGET__.ask('Hello guest');
  });

  const userBubble = page
    .locator('.valki-msg-row.user .valki-msg-bubble')
    .filter({ hasText: 'Hello guest' });
  await expect(userBubble.first()).toBeVisible();

  const history = await page.evaluate(() => window.__VICHAT_WIDGET__.guestHistory);
  expect(history[0]).toMatchObject({ type: 'user', text: 'Hello guest' });
  expect(history[0].images).toBeUndefined();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForWidget(page);

  const restoredHistory = await page.evaluate(() => window.__VICHAT_WIDGET__.guestHistory);
  expect(restoredHistory[0]).toMatchObject({ type: 'user', text: 'Hello guest' });
  expect(restoredHistory[0].images).toBeUndefined();

  const restoredBubble = page
    .locator('.valki-msg-row.user .valki-msg-bubble')
    .filter({ hasText: 'Hello guest' });
  await expect(restoredBubble.first()).toBeVisible();
  await expect(page.locator('.valki-msg-row.user .valki-msg-attachments')).toHaveCount(0);
});

test('guest history persists image attachments', async ({ page }) => {
  await routeHtml(page, '/test/guest-history.html', guestHistoryHtmlPath);
  await maybeRouteBuildAssets(page);
  await routeGuestApi(page);

  await page.goto(`${ORIGIN}/test/guest-history.html`, { waitUntil: 'domcontentloaded' });
  await waitForWidget(page);

  const fileInput = page.locator('#valki-file-input');
  await fileInput.setInputFiles(sampleImagePath);

  const trayImage = page.locator('#valki-attachments .valki-attachment img');
  await expect(trayImage.first()).toBeVisible({ timeout: 30_000 });

  await page.evaluate(async () => {
    await window.__VICHAT_WIDGET__.ask('Image guest');
  });

  const history = await page.evaluate(() => window.__VICHAT_WIDGET__.guestHistory);
  expect(history[0].images?.length).toBe(1);
  expect(history[0].images?.[0]?.dataUrl).toContain('data:image');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForWidget(page);

  const restoredHistory = await page.evaluate(() => window.__VICHAT_WIDGET__.guestHistory);
  expect(restoredHistory[0]).toMatchObject({ type: 'user', text: 'Image guest' });
  expect(restoredHistory[0].images?.[0]?.dataUrl).toContain('data:image');

  const restoredBubble = page
    .locator('.valki-msg-row.user .valki-msg-bubble')
    .filter({ hasText: 'Image guest' });
  await expect(restoredBubble.first()).toBeVisible();

  const restoredAttachment = page.locator('.valki-msg-row.user .valki-msg-attachments img');
  await expect(restoredAttachment.first()).toBeVisible();
});

test('guest history loads legacy entries without images', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'valki_history_v20:agent-a',
      JSON.stringify([{ type: 'user', text: 'Legacy guest message' }])
    );
  });

  await routeHtml(page, '/test/guest-history.html', guestHistoryHtmlPath);
  await maybeRouteBuildAssets(page);

  await page.goto(`${ORIGIN}/test/guest-history.html`, { waitUntil: 'domcontentloaded' });
  await waitForWidget(page);

  const legacyBubble = page
    .locator('.valki-msg-row.user .valki-msg-bubble')
    .filter({ hasText: 'Legacy guest message' });
  await expect(legacyBubble.first()).toBeVisible();
  await expect(page.locator('.valki-msg-row.user .valki-msg-attachments')).toHaveCount(0);
});

test('guest history remains scoped per agent', async ({ page }) => {
  await page.addInitScript((imageUrl) => {
    localStorage.setItem(
      'valki_history_v20:agent-a',
      JSON.stringify([{ type: 'user', text: 'Agent A message', images: [{ dataUrl: imageUrl }] }])
    );
    localStorage.setItem(
      'valki_history_v20:agent-b',
      JSON.stringify([{ type: 'user', text: 'Agent B message', images: [{ dataUrl: imageUrl }] }])
    );
  }, imageDataUrl);

  await routeHtml(page, '/test/guest-history.html', guestHistoryHtmlPath);
  await maybeRouteBuildAssets(page);

  await page.goto(`${ORIGIN}/test/guest-history.html`, { waitUntil: 'domcontentloaded' });
  await waitForWidget(page);

  const agentABubble = page
    .locator('.valki-msg-row.user .valki-msg-bubble')
    .filter({ hasText: 'Agent A message' });
  await expect(agentABubble.first()).toBeVisible();
  await expect(page.locator('.valki-msg-row.user .valki-msg-attachments img').first()).toBeVisible();

  await page.evaluate(async () => {
    await window.__VICHAT_WIDGET__.selectAgent('agent-b');
  });

  const agentBBubble = page
    .locator('.valki-msg-row.user .valki-msg-bubble')
    .filter({ hasText: 'Agent B message' });
  await expect(agentBBubble.first()).toBeVisible();
  await expect(page.locator('.valki-msg-row.user .valki-msg-attachments img').first()).toBeVisible();

  await expect(
    page.locator('.valki-msg-row.user .valki-msg-bubble').filter({ hasText: 'Agent A message' })
  ).toHaveCount(0);
});
