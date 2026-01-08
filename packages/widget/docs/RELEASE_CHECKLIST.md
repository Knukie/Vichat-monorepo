# Release Checklist

- [ ] Bump version in `package.json`.
- [ ] Run `npm ci`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e`.
- [ ] Update `CHANGELOG.md`.
- [ ] Regenerate SBOM: `node scripts/generate-sbom.mjs`.
- [ ] Verify `SBOM.json` and licenses.
- [ ] Publish updated assets from `dist/` (and any required `public/` files).
