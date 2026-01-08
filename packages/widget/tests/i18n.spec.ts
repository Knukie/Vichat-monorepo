import { test, expect } from '@playwright/test';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

test.describe('i18n', () => {
  test.describe('nl locale strings', () => {
    test.use({ locale: 'nl-NL' });

    test('uses Dutch placeholder copy', async ({ page }) => {
      const pageUrl = new URL('/test/step9.html', baseUrl).toString();
      await maybeRouteBuildAssets(page);

      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

      const badge = page.locator('#valki-bubble');
      await expect(badge).toBeVisible();
      await badge.click();

      await expect(page.locator('#valki-chat-input')).toHaveAttribute('placeholder', 'Wat ging er mis?');

      await page.screenshot({ path: 'step11-nl.png', fullPage: true });
    });
  });

  test.describe('ar locale strings', () => {
    test.use({ locale: 'ar' });

    test('uses Arabic placeholder copy', async ({ page }) => {
      const pageUrl = new URL('/test/step9.html', baseUrl).toString();
      await maybeRouteBuildAssets(page);

      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

      const badge = page.locator('#valki-bubble');
      await expect(badge).toBeVisible();
      await badge.click();

      await expect(page.locator('#valki-chat-input')).toHaveAttribute('placeholder', 'ما الذي حدث خطأ؟');

      await page.screenshot({ path: 'step11-ar.png', fullPage: true });
    });
  });
});
