import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// tests/ -> repo root is one level up, then test/assets/sample.png
const samplePath = path.join(__dirname, '..', 'test', 'assets', 'sample.png');

test('step6 overlay open/close with escape', async ({ page }) => {
  const pageUrl = new URL('/test/step6.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const overlay = page.locator('#valki-overlay');
  await expect(overlay).toHaveClass(/is-visible/);

  await page.keyboard.press('Escape');
  await expect(overlay).not.toHaveClass(/is-visible/);

  await page.screenshot({ path: 'step6-open-close.png', fullPage: true });
});

test('step6 text chat flow', async ({ page }) => {
  const pageUrl = new URL('/test/step6.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const input = page.locator('#valki-chat-input');
  await expect(input).toBeVisible();
  await input.fill('Hello from step 6');
  await input.press('Enter');

  const botMessages = page.locator('.valki-msg-row.bot .valki-msg-bubble').filter({ hasText: /\S+/ });
  await expect(botMessages.first()).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: 'step6-text.png', fullPage: true });
});

test('step6 attachments flow', async ({ page }) => {
  const pageUrl = new URL('/test/step6.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const fileInput = page.locator('#valki-file-input');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles(samplePath);

  const trayImage = page.locator('#valki-attachments .valki-attachment img');
  await expect(trayImage.first()).toBeVisible({ timeout: 30_000 });

  const input = page.locator('#valki-chat-input');
  await expect(input).toBeVisible();
  await input.fill('Attachment flow');

  const sendButton = page.locator('#valki-chat-send');
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toBeEnabled({ timeout: 30_000 });
  await sendButton.click();

  const userMessage = page
    .locator('.valki-msg-row.user .valki-msg-bubble')
    .filter({ hasText: 'Attachment flow' });
  await expect(userMessage.first()).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: 'step6-attach.png', fullPage: true });
});

test('step6 guest hard block disables composer', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('valki_guest_meter_v1', JSON.stringify({ count: 999, roundsShown: 2 }));
  });

  const pageUrl = new URL('/test/step6.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const authOverlay = page.locator('#valki-auth-overlay');
  await expect(authOverlay).toHaveClass(/is-visible/);

  const input = page.locator('#valki-chat-input');
  await expect(input).toBeDisabled();

  await page.screenshot({ path: 'step6-guest-block.png', fullPage: true });
});
