# Valki Talki Support Bundle

## Enable safe debug mode
1. Open the browser console on the host page.
2. Run:
   window.__VALKI_DEBUG__ = true;
3. Reload the page.

## Capture diagnostics
1. Open the widget.
2. In the console, run:
   window.__VALKI_DIAG__ && console.log(window.__VALKI_DIAG__())
3. Copy the output into the support ticket.

## Screenshots to collect
- Widget closed state (badge visible on the host page).
- Widget open state (header + composer visible).
- If using iframe mode: the host page with the iframe element highlighted in DevTools.
- Any visible errors in the browser console.

## CSP requirements (no unsafe-inline)
### Shadow DOM embed
- script-src: allow the widget loader and main bundle origin (e.g. https://auth.valki.wiki)
- style-src: allow the widget CSS asset origin
- connect-src: allow API origin (e.g. https://auth.valki.wiki)
- img-src: allow https: (for remote attachments)

### Iframe embed
- frame-src: allow the widget shell origin
- script-src/style-src/connect-src/img-src: same as above, inside the iframe

If the host uses strict CSP with nonces, provide the nonce via:
- window.__VALKI_NONCE__
- or a meta tag: <meta name="csp-nonce" content="...">

## Common host conflicts and fixes
- CSS resets hiding buttons: ensure the widget is in shadow mode or enable iframe mode if host styles are aggressive.
- Overlapping z-index: ensure no fixed-position overlays use z-index above 2147483647.
- Frame sandbox restrictions: if using iframe mode, the sandbox must allow scripts and same-origin.
- Cookie consent overlays: ensure the CMP allows user interaction or temporarily dismiss it before opening the widget.
