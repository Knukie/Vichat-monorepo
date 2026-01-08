# Dependencies

## Runtime Dependencies
- None. The widget bundle ships as static assets.

## Build/Test Dependencies
From `package.json`:
- `express` (development server)
- `esbuild` (build tooling via local shim)

## Updating Dependencies Safely
1. Update `package.json` and run `npm install` to refresh `package-lock.json`.
2. Run `npm run build` and `npm run test:e2e`.
3. Regenerate the SBOM with `node scripts/generate-sbom.mjs`.
4. Review `SBOM.json` for license changes.
