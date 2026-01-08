import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const pageUrl = new URL('/test/csp', baseUrl).toString();
const screenshotPath = path.join('artifacts', 'csp-chat-working.png');

const run = async () => {
  await fs.mkdir('artifacts', { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[browser console error]', msg.text());
    }
  });

  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#valki-top-badge', { timeout: 15000 });

  await page.click('#valki-top-badge');
  await page.waitForSelector('#valki-chat-input', { state: 'visible', timeout: 15000 });

  await page.fill('#valki-chat-input', 'Hello from the CSP test.');
  await page.click('#valki-chat-send');

  await page.waitForFunction(() => {
    const rows = Array.from(document.querySelectorAll('.valki-msg-row.bot .valki-msg-bubble'));
    return rows.some((row) => row.textContent && row.textContent.trim().length > 0);
  }, { timeout: 30000 });

  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();
  console.log(`Saved screenshot to ${screenshotPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
