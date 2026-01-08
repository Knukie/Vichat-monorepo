import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const guessContentType = (filePath: string) => {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'text/plain; charset=utf-8';
};

const startStaticServer = (rootDir: string) => {
  const server = createServer((req, res) => {
    const urlPath = new URL(req.url || '/', 'http://localhost').pathname;
    const safePath = path.normalize(urlPath).replace(/^\\+/, '/').replace(/^\//, '');
    const requested = safePath ? path.join(rootDir, safePath) : path.join(rootDir, 'tools', 'demo.html');

    const filePath = fs.existsSync(requested) && fs.statSync(requested).isDirectory()
      ? path.join(requested, 'index.html')
      : requested;

    if (!filePath.startsWith(rootDir)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const body = fs.readFileSync(filePath);
    res.writeHead(200, { 'content-type': guessContentType(filePath) });
    res.end(body);
  });

  return new Promise<{ close: () => void; url: string }>((resolve) => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      resolve({
        close: () => server.close(),
        url: `http://localhost:${address.port}`
      });
    });
  });
};

const viChatStatus = async (page: any) => {
  return page.evaluate(() => ({
    exists: typeof window !== 'undefined' && typeof (window as any).ViChat !== 'undefined',
    mountIsFunction: typeof (window as any).ViChat?.mount === 'function'
  }));
};

test('widget bundle mounts and opens chat overlay', async ({ page }) => {
  const projectRoot = path.join(__dirname, '..');
  const server = await startStaticServer(projectRoot);

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  try {
    const demoUrl = `${server.url}/tools/demo.html`;
    await page.goto(demoUrl, { waitUntil: 'networkidle' });

    const initialStatus = await viChatStatus(page);
    expect(initialStatus.exists).toBeTruthy();
    expect(initialStatus.mountIsFunction).toBeTruthy();

    const bubble = page.locator('#valki-bubble');
    await expect(bubble).toBeVisible({ timeout: 15000 });

    await bubble.click();

    const overlay = page.locator('#valki-overlay');
    await expect(overlay).toBeVisible({ timeout: 15000 });

    await fs.promises.mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/widget-working.png', fullPage: true });

    const finalStatus = await viChatStatus(page);
    expect(finalStatus.exists).toBeTruthy();
    expect(finalStatus.mountIsFunction).toBeTruthy();

    expect(consoleErrors.some((msg) => msg.includes('Invalid or unexpected token'))).toBeFalsy();
    expect(pageErrors).toHaveLength(0);
  } finally {
    server.close();
  }
});
