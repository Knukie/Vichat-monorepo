# Vichat Integration Guide

The widget bundle ships as `/dist/vichat-widget.min.js` and exposes `window.ViChat.mount()`.
Production source lives in `/src`, and `/widget` is reserved for host/demo/example pages that load `/dist`.
Both themes reuse the exact backend/API flows from `legacy/valki-talki-single.html`.
An optional stylesheet is available at `/dist/vichat-widget.css` if you want to load styles separately from the script.

## Quick embeds

### ViChat (default)
```html
<link rel="stylesheet" href="https://cdn.example.com/dist/vichat-widget.css" />
<script src="https://cdn.example.com/dist/vichat-widget.min.js" defer></script>
<script>
  window.ViChat.mount({
    theme: 'vichat',
    baseUrl: 'https://auth.valki.wiki'
  });
</script>
```

### Valki Talki theme
```html
<link rel="stylesheet" href="https://cdn.example.com/dist/vichat-widget.css" />
<script src="https://cdn.example.com/dist/vichat-widget.min.js" defer></script>
<script>
  window.ViChat.mount({
    theme: 'valki',
    baseUrl: 'https://auth.valki.wiki'
  });
</script>
```

## Options
- `theme`: `"vichat"` (default) or `"valki"`.
- `baseUrl`: API/auth origin (defaults to `https://auth.valki.wiki`).
- `target`: Optional element or selector to append the widget root into.
- `avatarUrl` and other overrides map onto the legacy constants; request/response schema is unchanged:
  - `POST /api/valki` with `{ message, clientId, images:[{name,type,dataUrl}] }` → `{ reply }`.

## CSP starter

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://cdn.example.com;
  style-src 'self' https://cdn.example.com;
  connect-src 'self' https://auth.valki.wiki;
  img-src 'self' data: https://cdn.example.com;
  font-src 'self' https://cdn.example.com;
```

Add your CDN hostname to `script-src`, `style-src`, `img-src`, and `font-src`. The widget runs in the host page (no iframe by default).
