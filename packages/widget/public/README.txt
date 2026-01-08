Valki Talki CDN bundle

Upload these files to your CDN origin with long-cache headers (immutable) for the hashed assets.

Required files:
- valki-talki.js (loader, stable filename)
- valki-talki-main.4ae6efe7.js
- valki-talki.7ac16ae8.css
- valki-talki-manifest.json
- shell.html (for iframe mode)

Install using:
<script defer src="https://cdn.example.com/valki/valki-talki.js"></script>

Optionally configure with data attributes on the loader script:
data-valki-base-url, data-valki-embed-mode, data-valki-mount-selector, data-valki-debug, data-valki-flags
