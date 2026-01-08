// server.js (Node 20 + ESM: "type": "module")
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

// --- Paths (pas dit aan als jouw repo anders is) ---
const widgetDir = path.join(__dirname, 'widget'); // ✅ host/demo/examples (no runtime code)
const publicDir = path.join(__dirname, 'public'); // ✅ optioneel: algemene public files
const strictCspHtmlPath = path.join(publicDir, 'test', 'strict-csp.html'); // ✅ tests verwachten /test/strict-csp.html
const distDir = path.join(__dirname, 'dist');

// --- CORS voor widget assets (handig bij embed) ---
function applyWidgetCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Allow', 'GET, OPTIONS');
}

// Preflight
app.options('/widget/*', (_req, res) => {
  applyWidgetCors(res);
  res.sendStatus(204);
});

// Health
app.get('/', (_req, res) => {
  res.status(200).send('OK');
});

// Debug: laat zien welke files er bestaan (handig in CI)
app.get('/_debug/widget-files', (_req, res) => {
  try {
    const files = fs.existsSync(widgetDir) ? fs.readdirSync(widgetDir) : [];
    res.json({ widgetDir, exists: fs.existsSync(widgetDir), files });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Backwards-compatible redirects for legacy asset URLs
app.get('/widget/vichat-widget.js', (_req, res) => {
  res.redirect(301, '/dist/vichat-widget.min.js');
});

app.get('/widget/vichat-widget.css', (_req, res) => {
  res.redirect(301, '/dist/vichat-widget.css');
});

app.get('/widget/demo.html', (_req, res) => {
  res.redirect(301, '/widget/host/demo.html');
});

app.get('/widget/valki-talki.js', (_req, res) => {
  res.redirect(301, '/dist/vichat-widget.min.js');
});

app.get('/widget/valki-talki-main.js', (_req, res) => {
  res.redirect(301, '/dist/vichat-widget.min.js');
});

app.get('/widget/valki-talki.css', (_req, res) => {
  res.redirect(301, '/dist/vichat-widget.css');
});

// Serve widget assets
app.use(
  '/widget',
  express.static(widgetDir, {
    setHeaders: (res, filePath) => {
      applyWidgetCors(res);
      res.setHeader('Cache-Control', 'public, max-age=60');

      // Extra: content-type failsafe (meestal doet express dit al goed)
      if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
      if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  })
);

// Serve dist bundle (new API)
app.use(
  '/dist',
  express.static(distDir, {
    setHeaders: (res, filePath) => {
      applyWidgetCors(res);
      res.setHeader('Cache-Control', 'public, max-age=60');
      if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  })
);

// (Optioneel) serve overige public assets
app.use(
  '/public',
  express.static(publicDir, {
    setHeaders: (res, filePath) => {
      res.setHeader('Cache-Control', 'public, max-age=60');
      if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  })
);

// Test page route EXACT zoals Playwright smoke tests gebruiken
app.get('/test/strict-csp.html', (_req, res) => {
  // CSP voorbeeld: pas connect-src aan naar jouw API(s)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self' https://auth.valki.wiki",
      "frame-ancestors 'none'"
    ].join('; ')
  );

  res.sendFile(strictCspHtmlPath, (err) => {
    if (err) {
      res
        .status(404)
        .send(
          `Missing test HTML at ${strictCspHtmlPath}\n\nFix: create public/test/strict-csp.html (or update strictCspHtmlPath in server.js).`
        );
    }
  });
});

// Fallback 404 (handig voor debugging)
app.use((req, res) => {
  res.status(404).send(`Not Found: ${req.method} ${req.path}`);
});

app.listen(PORT, () => {
  console.log(`Valki Talki widget server running on http://localhost:${PORT}`);
  console.log(`Serving widget from: ${widgetDir}`);
  console.log(`Serving public from: ${publicDir}`);
});
