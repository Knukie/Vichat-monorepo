# Project Audit Report (Vichat-monorepo)

Date: 2026-01-10

## Summary

**What works**
- Monorepo wiring is simple: `pnpm-workspace.yaml` includes `packages/*`, and root scripts delegate `build/typecheck/test` to all workspaces.
- Backend (`packages/bot`) exposes a consistent Express API for auth, uploads, message history, guest import, and Valki inference.
- Widget (`packages/widget`) is a self-contained ESBuild bundle with a local dev server and a lightweight JS UI (no framework).
- Contracts (`packages/contracts`) provide a small shared type surface for messages, images, users, and conversations.

**What’s risky / unclear**
- Contracts don’t match runtime shapes for user, message roles, and image metadata; the widget/HTTP API use additional fields and different role values.
- `valki-bot` mixes Prisma schema/migrations with direct `pg` usage; `start:api` / `start:worker` do not run migrations.
- Widget defaults to `https://auth.valki.wiki` while backend CORS defaults allow only `https://valki.wiki` and `https://www.valki.wiki`; CORS may block embeds unless `CORS_ORIGINS` is updated.
- `/api/valki` includes `assistantImages` and echoes cleaned `images`, but the widget ignores both, so assistant attachments will never render.

---

## Repository overview (scripts + configs)

**Root workspace**
- `pnpm-workspace.yaml` scopes the monorepo to `packages/*`.
- Root `package.json` scripts:
  - `build`: `pnpm -r build`
  - `typecheck`: `pnpm -r typecheck`
  - `test`: `pnpm -r test`

**Deployment config**
- `nixpacks.toml` installs Node 22 + pnpm, runs `pnpm --filter valki-bot build`, and starts with `pnpm --filter valki-bot start` (which runs Prisma migrations first).

---

## Per-package overview

### `packages/contracts` (`@valki/contracts`)
- **Entry**: `dist/index.js` (built from `src/index.ts`).
- **Build**: `tsc -p .` (also used for typecheck).
- **Exports**:
  - `ImageMeta` / `ImageMetadata` alias (`src/image.ts` + `src/index.ts`).
  - `Message`, `Role` (`src/message.ts`).
  - `Conversation`, `ConversationStatus` (`src/conversation.ts`).
  - `User`, `UserRole`, `UserStatus` (`src/user.ts`).

### `packages/bot` (`valki-bot`)
- **Entry**: `src/api/server.js` (ESM). Uses Express, Prisma client, and `pg`.
- **Runtime**: `start` runs `prisma migrate deploy && node src/api/server.js`.
- **Notable config**: `src/core/config.js` reads envs for CORS, auth, DB, OpenAI, uploads, S3.
- **Storage**: `src/core/db.js` uses raw SQL via `pg` for user/conversation/message tables.
- **Uploads**: `src/core/uploads.js` stores to `/tmp/valki-uploads` or S3-compatible endpoint.

**HTTP endpoints (current)**
- **Health/Auth**:
  - `GET /`
  - `GET /health`
  - `GET /ready`
  - `GET /db/check`
  - `GET /auth/discord`
  - `GET /auth/discord/callback`
  - `GET /auth/google`
  - `GET /auth/google/callback`
- **API**:
  - `GET /api/me` (optional auth)
  - `POST /api/upload` (optional auth)
  - `GET /api/messages` (optional auth; guests must provide `conversationId`)
  - `DELETE /api/message/:id` (auth)
  - `POST /api/clear` (auth)
  - `POST /api/import-guest` (auth)
  - `POST /api/valki` (optional auth + rate limited)

### `packages/widget` (`vichat-widget`)
- **Entry**: `src/index.js` (bundled by `build/esbuild.mjs` into `dist/vichat-widget.min.js` + CSS).
- **Dev server**: `server.js` (Express).
- **Key modules**:
  - API client: `src/core/api.js`
  - Config/endpoints: `src/core/config.js`
  - Attachments: `src/core/attachments.js`
  - Message UI: `src/core/ui/messages.js`
  - Local storage: `src/core/storage.js`
- **E2E tests**: Playwright specs in `tests/`.

---

## Risks / unclear items (detailed)

1) **Contracts vs runtime user shape**
   - Contracts `User` expects `{ id, role, displayName, avatarUrl, status }`, but `/api/me` returns `{ id, name, provider }`. The widget treats `name` as optional, not `displayName`.

2) **Contracts vs runtime message roles**
   - Contracts `Role` is `customer|assistant|agent|system|bot`.
   - Backend stores `user`/`assistant` roles in `messages` and returns those from `/api/messages`.
   - Widget maps `assistant` → `bot` and everything else → `user` when rendering history.

3) **Image metadata shape divergence**
   - Contracts `ImageMeta` only has `{ url, type }`.
   - Backend sanitization and storage also include `{ name, size, host }`.
   - Widget sends/receives `name` and `size` fields when uploading or importing guest history.

4) **Widget default base URL vs CORS defaults**
   - Widget defaults to `https://auth.valki.wiki` while backend CORS defaults allow only `https://valki.wiki` and `https://www.valki.wiki`.
   - Without adding `auth.valki.wiki` to `CORS_ORIGINS`, embeds may fail preflight or auth popups could be blocked.

5) **Valki response images are unused by widget**
   - `/api/valki` responds with `{ reply, conversationId, images?, assistantImages?, warnings? }`.
   - `askValki` ignores `images` and `assistantImages` and only returns `{ ok, message }`.
   - Any assistant-provided images are not rendered or stored in guest history.

6) **Prisma migrations are not guaranteed for all entrypoints**
   - `start` runs migrations, but `start:api` and `start:worker` do not.
   - Since `pg` is used directly for runtime queries, schema drift can happen if migrations aren’t deployed.

---

## Key route/type mismatches

### 1) `/api/me` payload vs `User` contract
- **Backend**: `{ loggedIn: true, user: { id, name, provider } }`.
- **Contracts**: `User` requires `role`, `displayName`, `avatarUrl`, `status`.
- **Widget**: `UiUser` extends contract but treats `name` as optional.

### 2) `/api/messages` role values vs `Role` contract
- **Backend**: stores/returns `role` values `user` and `assistant`.
- **Contracts**: `Role` does not include `user`.
- **Widget**: maps `assistant` → `bot`, everything else → `user`.

### 3) `/api/valki` request payload vs backend expectations
- **Widget**: sends `{ message, clientId, images, agentId }`.
- **Backend**: reads `{ message, conversationId, locale, clientId, images }`; `agentId` is ignored.

### 4) Image metadata (`ImageMeta`) vs backend storage/response
- **Backend**: `sanitizeImages` + DB storage include `name`, `size`, `host` in addition to `url` + `type`.
- **Contracts**: `ImageMeta` only has `url` + `type`.
- **Widget**: uses `name`, `size`, and `dataUrl` in multiple places.

---

## Package-by-package notes

### Backend (`packages/bot`)
- **Uploads**: `/api/upload` only accepts JPEG/PNG, max 5 MB; uploads locally or to S3-compatible endpoint.
- **Image handling**:
  - `/api/valki` normalizes/filters image URLs, rejects `data:`/`blob:`.
  - Guest import (`/api/import-guest`) accepts `dataUrl` and uploads it server-side via `normalizeImportImages`.
- **Messages**:
  - `saveMessage` stores JSONB image metadata and logs warnings for invalid images.
  - `/api/messages` returns up to 200 messages, ordered ascending by ID.

### Widget (`packages/widget`)
- **Guest history**: stored in localStorage with `dataUrl` and optional `url` fields; imports into `/api/import-guest` on login.
- **Uploads**: client uploads attachments to `/api/upload` and sends resulting URLs to `/api/valki`.
- **Rendering**: message renderer accepts `url` or `dataUrl`, so locally stored images display even if not uploaded.

### Contracts (`packages/contracts`)
- Focused on minimal domain types with only `url` + `type` for images; does not include UI-only fields or backend-specific metadata.

---

## Evidence pointers (paths)

- Backend server entry + routes: `packages/bot/src/api/server.js`
- Contracts barrel + types: `packages/contracts/src/index.ts`, `src/image.ts`, `src/message.ts`, `src/user.ts`
- Widget API client + config: `packages/widget/src/core/api.js`, `packages/widget/src/core/config.js`
- Widget storage + UI: `packages/widget/src/core/storage.js`, `packages/widget/src/core/ui/messages.js`
- Upload pipeline + image normalization: `packages/bot/src/core/uploads.js`, `packages/bot/src/core/images.js`, `packages/bot/src/core/imageProcessing.js`

---

## Output

AUDIT.md regenerated at repository root.
