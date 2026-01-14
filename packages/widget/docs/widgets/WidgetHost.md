# WidgetHost

`WidgetHost` is the shared layout shell that wraps all embedded widgets. It provides a stable container, predictable sizing, and a flex-based layout so chat-style widgets always render with the input bar pinned to the bottom (even when the widget switches views such as agent hub → chat).

## Why it exists

Embedding third-party widgets inside arbitrary host pages can introduce layout jitter, initial render mis-measurements, or input misalignment. The WidgetHost fixes that by:

- Providing a consistent fixed-position container for floating widgets.
- Normalizing layout to flex column so header/body/footer alignment is stable.
- Offering safe, minimal overrides for iframe-based widgets.
- Applying a small layout nudge after mount or view changes to ensure the chat composer height is measured correctly.

## Default behavior

By default, the host is created with:

- `type: "chat"`
- `provider: "valki-vichat"`
- `placement: "floating"` when mounting to `document.body` (or `inline` for custom targets)
- Desktop sizing of ~420px width and max-height `80vh`
- Flex column layout with the child filling the host

## Integration pattern

Every widget integration should use the host wrapper. In `window.ViChat.mount`, the host is created automatically:

```js
window.ViChat.mount({
  theme: 'valki',
  mode: 'agent-hub',
  widgetHost: {
    type: 'chat',
    provider: 'valki-vichat',
    placement: 'floating',
    width: 420,
    maxHeight: '80vh'
  }
});
```

For inline embeds:

```js
window.ViChat.mount({
  target: '#support-widget-slot',
  widgetHost: {
    type: 'panel',
    placement: 'inline'
  }
});
```

### Supported options

`widgetHost` accepts the following fields:

- `type`: `"chat" | "panel" | "floating-bubble" | "custom"`
- `provider`: string identifier (e.g., `"valki-vichat"`)
- `placement`: `"floating" | "inline"`
- `width`, `height`, `maxWidth`, `maxHeight`, `minHeight`
- `right`, `bottom`, `offsetX`, `offsetY`
- `className`, `id`

## Styling guidance

- Put widget host layout rules in `src/themes/widget-host.css` so they remain centralized.
- Avoid globally targeting internal widget classes unless absolutely necessary.
- If you need to adjust spacing or size, prefer `widgetHost` configuration over CSS overrides.

## Notes on alignment fixes

The host performs a small layout “nudge” on mount and when switching to chat view. This addresses first-render alignment issues in multi-view widgets by forcing a re-measure of the composer height after the layout is stable.
