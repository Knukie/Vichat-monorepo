# ViChat / Valki Talki Integration

The distributable bundle lives at `/dist/vichat-widget.min.js` and exposes a single public API:

```js
window.ViChat.mount(options)
```

The widget markup, behaviors, and backend calls are identical to the legacy `legacy/valki-talki-single.html` implementation.
An optional stylesheet is available at `/dist/vichat-widget.css` if you prefer to include CSS separately.

## Quick start (ViChat default)

```html
<link rel="stylesheet" href="https://cdn.example.com/dist/vichat-widget.css" />
<script src="https://cdn.example.com/dist/vichat-widget.min.js" defer></script>
<script>
  window.ViChat.mount({
    theme: 'vichat',          // default theme (ViChat)
    baseUrl: 'https://auth.valki.wiki' // keep legacy backend
  });
</script>
```

## Valki Talki theme

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
- `baseUrl`: API/auth origin. Defaults to `https://auth.valki.wiki`.
- `target`: Optional DOM element or selector to append the widget root into (defaults to `<body>`).
- `avatarUrl`: Override the assistant avatar image.
- `onOpen`: Optional callback fired when the chat opens.
- `onClose`: Optional callback fired when the chat closes.
- `widgetHost`: Configuration for layout/positioning:
  - `zIndex`: Override the base z-index used for the launcher + overlay.
  - `offset`: `{ x, y }` or `{ right, bottom }` to offset the launcher from the viewport edge.
  - `useSafeAreaInsets`: Boolean (default `true`) to include `env(safe-area-inset-*)` on mobile.
- Any other overrides map onto the legacy constants (guest limits, copy, etc.) while retaining the same request/response schema:
  - `POST /api/valki` with `{ message, clientId, images:[{name,type,dataUrl}] }` → `{ reply }`.

Load the script once per page. Calling `mount` again replaces any existing widget instance, allowing you to switch themes without reloading the host page.

## State hooks & events

- The widget root gets `data-state="open|closed"`.
- The document root toggles `html.vichat-open` while the chat is open.
- The widget dispatches CustomEvents on `window`:
  - `vichat:ready`
  - `vichat:open`
  - `vichat:close`
