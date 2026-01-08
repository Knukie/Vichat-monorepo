import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';

const useBuild = process.env.VALKI_USE_BUILD === '1' || process.env.VALKI_USE_BUILD === undefined;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', '..', 'dist');
const defaultWidgetScript = 'vichat-widget.min.js';
const defaultWidgetCss = 'vichat-widget.css';

const contentTypeFor = (assetName: string) => {
  if (assetName.endsWith('.css')) return 'text/css';
  return 'application/javascript';
};

const fulfillAsset = async (route: Route, assetName: string) => {
  try {
    const filePath = path.join(distDir, assetName);
    const body = await fs.readFile(filePath);
    await route.fulfill({
      status: 200,
      body,
      headers: {
        'content-type': contentTypeFor(assetName)
      }
    });
  } catch {
    await route.continue();
  }
};

export const maybeRouteBuildAssets = async (page: Page) => {
  if (!useBuild) return;

  await page.route('**/dist/vichat-widget.min.js', async (route) => {
    await fulfillAsset(route, defaultWidgetScript);
  });

  await page.route('**/dist/vichat-widget.css', async (route) => {
    await fulfillAsset(route, defaultWidgetCss);
  });
};
