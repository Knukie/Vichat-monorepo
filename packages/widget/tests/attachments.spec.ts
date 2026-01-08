import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// tests/ -> repo root is one level up, then test/assets/sample.png
const samplePath = path.join(__dirname, '..', 'test', 'assets', 'sample.png');

test('strict csp attachments flow', async ({ page }) => {
  const pageUrl = new URL('/test/strict-csp.html', baseUrl).toString();
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
  await input.fill('Attachment test');

  const sendButton = page.locator('#valki-chat-send');
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toBeEnabled({ timeout: 30_000 });
  await sendButton.click();

  const userMessage = page
    .locator('.valki-msg-row.user .valki-msg-bubble')
    .filter({ hasText: 'Attachment test' });
  await expect(userMessage.first()).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: 'csp-attachments-working.png', fullPage: true });
});
