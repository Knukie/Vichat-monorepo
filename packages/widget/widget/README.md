# Widget host/demo harness

This folder contains **host/demo/example pages only**. It intentionally loads the production
widget bundle from `/dist` and does **not** include any widget implementation code.

## Structure

- `host/` — demo host pages that load the production bundle from `/dist`.
- `examples/` — small embed examples for different environments.
- `legacy-assets/` — legacy build outputs kept for reference only. Do not use these for new embeds.

The production widget source of truth lives in `/src` and is bundled by `npm run build` into
`dist/vichat-widget.min.js` and `dist/vichat-widget.css`.
