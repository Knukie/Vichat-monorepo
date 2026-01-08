import { test, expect } from '@playwright/test';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

test('overlay focus and escape behavior', async ({ page }) => {
  const pageUrl = new URL('/test/step9.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);

  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const input = page.locator('#valki-chat-input');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();

  const deleteButton = page.locator('#valki-deleteall-btn');
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  const confirm = page.locator('#valki-confirm-overlay');
  await expect(confirm).toHaveClass(/is-visible/);

  await page.keyboard.press('Escape');
  await expect(confirm).not.toHaveClass(/is-visible/);

  // Overlay should still be open (chat still active)
  await expect(page.locator('#valki-overlay')).toHaveClass(/is-visible/);

  const closeButton = page.locator('#valki-close');
  await expect(closeButton).toBeVisible();
  await closeButton.click();

  await page.screenshot({ path: 'step11-a11y.png', fullPage: true });
});
