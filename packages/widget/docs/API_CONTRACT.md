# Vichat Widget API Contract (Stable)

This document defines the stable public contract for the Vichat widget. Breaking changes follow the deprecation policy below and only occur on major version bumps.

## Embed Snippets

```html
<link rel="stylesheet" href="https://cdn.example.com/dist/vichat-widget.css" />
<script defer src="https://cdn.example.com/dist/vichat-widget.min.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    if (window.ViChat?.mount) {
      window.ViChat.mount({
        theme: 'vichat',
        baseUrl: 'https://auth.valki.wiki'
      });
    }
  });
</script>
```

## Config Sources + Precedence (Stable)

Configuration is resolved from:

1. Options passed to `window.ViChat.mount({ ... })`
2. Defaults baked into the bundle

## Supported Config Keys (Stable)

These keys are stable and backward-compatible:

- `theme` (`"vichat"` or `"valki"`)
- `baseUrl` (API/auth origin)
- `target` (element or selector to mount into)
- `avatarUrl`
- `agents`
- `startAgentId`
- `mode`

## Backward Compatibility Promise

- Local storage keys and backend request/response schema remain compatible with the legacy
  implementation.

## Deprecation Policy

- Deprecations are announced in release notes.
- Deprecated fields continue to work for at least one minor version.
- Removals only occur in major releases with documented migration guidance.
