import { test, expect } from '@playwright/test';
import { maybeRouteBuildAssets } from './helpers/buildAssets';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

test('step9 renders guest history from storage', async ({ page }) => {
  await page.addInitScript(() => {
    const history = [
      { type: 'user', text: 'Legacy question' },
      { type: 'bot', text: 'Legacy reply' }
    ];
    localStorage.setItem('valki_history_v20', JSON.stringify(history));
  });

  const pageUrl = new URL('/test/step9.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const userMessage = page.locator('.valki-msg-row.user .valki-msg-bubble').filter({ hasText: 'Legacy question' });
  const botMessage = page.locator('.valki-msg-row.bot .valki-msg-bubble').filter({ hasText: 'Legacy reply' });
  await expect(userMessage).toHaveCount(1);
  await expect(botMessage).toHaveCount(1);

  await page.screenshot({ path: 'step9-history.png', fullPage: true });
});

test('step9 delete clears guest history', async ({ page }) => {
  await page.addInitScript(() => {
    const history = [
      { type: 'user', text: 'Delete me' },
      { type: 'bot', text: 'Okay' }
    ];
    localStorage.setItem('valki_history_v20', JSON.stringify(history));
  });

  const pageUrl = new URL('/test/step9.html', baseUrl).toString();
  await maybeRouteBuildAssets(page);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

  const badge = page.locator('#valki-bubble');
  await expect(badge).toBeVisible();
  await badge.click();

  const deleteButton = page.locator('#valki-deleteall-btn');
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  const confirmButton = page.locator('#valki-confirm-yes');
  await expect(confirmButton).toBeVisible();
  await confirmButton.click();

  await expect(page.locator('.valki-msg-row')).toHaveCount(0);

  const history = await page.evaluate(() => localStorage.getItem('valki_history_v20'));
  expect(history).toBeNull();

  await page.screenshot({ path: 'step9-delete.png', fullPage: true });
});
