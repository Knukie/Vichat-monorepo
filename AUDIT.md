# Project Audit Report (Vichat-monorepo)

Date: 2025-02-14

## Summary

**What works**
- Shared contracts package exports core domain types (Message, Conversation, User, ImageMeta) from a single barrel file, with an ImageMetadata alias for compatibility.
- Backend exposes an HTTP API with auth, message history, upload, and Valki inference routes; image normalization and storage are handled server-side.
- Widget builds via an esbuild pipeline and has a consistent config layer for endpoint URLs.

**What’s risky / unclear**
- The widget collects image attachments as base64 data URLs and sends them in `images`, but the backend explicitly strips legacy base64 payloads and only accepts URL-based images; uploads are available but not used by the widget.
- Backend uses both raw SQL (pg) and a Prisma schema; migrations exist, but runtime DB writes are done via `pg`, so Prisma-generated types may not reflect runtime usage.
- Widget fetches message history but maps it down to `{ role, text }` only, losing images and metadata.
- Widget README describes a React/TSX structure that does not exist in the current codebase, which can mislead UI work.
- `/api/messages` requires auth or a guest conversation ID; the widget only fetches messages when logged in, so guest history is local-only.

---

## A) Monorepo overview

### Workspace packages (from `pnpm-workspace.yaml` + package.json)

| Package | Path | Module Type | Main Entry | TS Config | Scripts (build/start/dev/typecheck/test) |
| --- | --- | --- | --- | --- | --- |
| `@valki/contracts` | `packages/contracts` | CJS default (no `type` field) | `dist/index.js` | `packages/contracts/tsconfig.json` | build ✅ / start ❌ / dev ❌ / typecheck ✅ / test ❌ |
| `valki-bot` | `packages/bot` | ESM (`type: "module"`) | `src/api/server.js` | `packages/bot/tsconfig.json` | build ✅ / start ✅ / dev ✅ / typecheck ✅ / test ✅ (placeholder) |
| `vichat-widget` | `packages/widget` | ESM (`type: "module"`) | `server.js` | none | build ✅ / start ✅ / dev ❌ / typecheck ❌ / test ✅ (e2e only) |

---

## B) Contracts audit (`@valki/contracts`)

### Public exports (barrel file)
Source: `packages/contracts/src/index.ts`

```
// ImageMeta is canonical; ImageMetadata is a compatibility alias.
export type { ImageMeta } from "./image.js";
export type { ImageMeta as ImageMetadata } from "./image.js";
export type { Message, Role } from "./message.js";
export type { Conversation, ConversationStatus } from "./conversation.js";
export type { User, UserRole, UserStatus } from "./user.js";
```

**Exported domain types**
- `ImageMeta` (alias: `ImageMetadata`)
- `Message`, `Role`
- `Conversation`, `ConversationStatus`
- `User`, `UserRole`, `UserStatus`

### Canonical image type(s)
- Canonical: `ImageMeta`
- Alias: `ImageMetadata` (defined in `src/index.ts` as a re-export alias)

### Mismatches / risks
1) **Backend image metadata includes extra fields not defined in contracts.**
   - Backend `ImageMeta` typedef includes `name`, `size`, `host` optional fields.
   - Contract `ImageMeta` only has `url` + `type`.

2) **Widget sends base64 attachments in `images`, but backend strips them.**
   - Backend sanitization explicitly removes `dataUrl` / `data` fields.

**Minimal fix strategy**
- **Preferred**: Add an upload step in the widget that calls `/api/upload` and converts attachments into `{ url, type, name, size }` before sending to `/api/valki`.
- **If needed**: Extend `ImageMeta` in contracts to include optional `name`, `size`, `host` (to match backend), and update widget to use only URL-based images.

---

## C) Backend audit (`packages/bot`)

### Server entrypoint + PORT
- Entrypoint: `packages/bot/src/api/server.js`
- PORT: `config.PORT` (default `3000`), defined in `packages/bot/src/core/config.js`

Excerpt (server listen):
```
const port = Number(config.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`🌐 HTTP API running on port ${port} (${config.NODE_ENV})`);
});
```

Excerpt (config):
```
export const config = {
  PORT: env.PORT ?? "3000",
  NODE_ENV: env.NODE_ENV ?? "production",
  ...
};
```

### Express routes/endpoints
All defined in `packages/bot/src/api/server.js`:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | health text |
| GET | `/health` | JSON uptime/env |
| GET | `/ready` | DB readiness check |
| GET | `/db/check` | DB sanity check |
| GET | `/auth/discord` | OAuth start |
| GET | `/auth/discord/callback` | OAuth callback |
| GET | `/auth/google` | OAuth start |
| GET | `/auth/google/callback` | OAuth callback |
| GET | `/api/me` | auth optional |
| POST | `/api/upload` | multipart upload |
| GET | `/api/messages` | auth optional, guest needs conversationId |
| DELETE | `/api/message/:id` | auth required |
| POST | `/api/clear` | auth required |
| POST | `/api/import-guest` | auth required |
| POST | `/api/valki` | auth optional (rate limited) |

### Messages + images handling
- **Messages storage**: `saveMessage` in `packages/bot/src/core/db.js` inserts into `messages` table (JSONB images).
- **Message creation**: `runValki` in `packages/bot/src/core/valki.js` saves both user and assistant messages.
- **Upload flow**: `/api/upload` uses `parseMultipartImage` + `storeUploadedFile` (local or S3).
- **Image normalization**: `sanitizeImages` in `packages/bot/src/core/images.js` (drops base64 payloads, enforces type/URL, caps 4 images).

Excerpt (sanitizeImages base64 drop + allowed URLs):
```
const hasLegacyData = item?.dataUrl || item?.data;
if (hasLegacyData) {
  warnings.push("Removed legacy base64 image payload; only image URLs are supported.");
}

const url = cleanText(item?.url);
if (!isAllowedUrl(url)) continue;
```

Excerpt (upload route):
```
app.post("/api/upload", optionalAuth, (req, res) => {
  ...
  const meta = await storeUploadedFile({
    buffer: file.buffer,
    mime: normalizeMime(file.mimetype),
    name: file.originalname,
    size: file.size
  });
  return res.json({ url: publicUrl, mime: meta?.type, size: meta?.size, name: meta?.name });
});
```

### Error handling patterns
- Mostly `res.status(...).json({ error: "..." })` with string messages.
- Some responses include `requestId`, but no structured error codes or enums are used.

Excerpt:
```
if (err?.type === "entity.too.large") {
  return res.status(413).json({ error: "Image too large. Max 5 MB." });
}
...
return res.status(500).json({ error: "ksshh… Internal backend error", requestId });
```

### Prisma audit
- `schema.prisma`: `packages/bot/prisma/schema.prisma`
- Migrations: **3** folders in `packages/bot/prisma/migrations`
- Scripts:
  - `build`: `pnpm prisma:generate`
  - `start`: `prisma migrate deploy && node src/api/server.js`
  - `start:api`: `node src/api/server.js` (no migrations)
  - `start:worker`: `node src/worker/discord.js` (no migrations)

**Potential Railway risk**
- If Railway runs `start:api` or `start:worker` directly, migrations won’t run.
- Build step only generates the Prisma client; runtime DB access is mostly `pg` in `core/db.js`.

---

## D) Widget audit (`packages/widget`)

### Entry + build tooling
- Build tool: custom **esbuild** script (`packages/widget/build/esbuild.mjs`)
- JS entry: `packages/widget/src/index.js`
- Build output: `packages/widget/dist/vichat-widget.min.js` + `vichat-widget.css`
- Dev server: `packages/widget/server.js` (`npm run start`)

### API client usage
- API client module: `packages/widget/src/core/api.js`
- Endpoints set in `packages/widget/src/core/config.js`
- The widget calls:
  - `GET /api/me`
  - `GET /api/messages`
  - `POST /api/clear`
  - `POST /api/import-guest`
  - `POST /api/valki`
- **No call to `/api/upload`** exists in the widget code.

Excerpt (endpoint build):
```
return {
  baseUrl: trimmed,
  apiValki: `${trimmed}/api/valki`,
  apiMe: `${trimmed}/api/me`,
  apiMessages: `${trimmed}/api/messages`,
  apiClear: `${trimmed}/api/clear`,
  apiImportGuest: `${trimmed}/api/import-guest`,
  ...
};
```

### Payload shapes + contracts usage
- Types are imported from `@valki/contracts` via JSDoc.
- `askValki` payload includes `{ message, clientId, images, agentId }`.
- Attachments are stored as `{ name, type, dataUrl }` and forwarded directly.

Excerpt (askValki payload):
```
const payload = { message, clientId, images, agentId };
...
await fetch(config.apiValki, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload)
});
```

Excerpt (attachments snapshot includes dataUrl):
```
return (attachments || []).map((att) => ({
  name: att?.name || 'image',
  type: att?.type || 'image/jpeg',
  dataUrl: att?.dataUrl || ''
}));
```

### UI components for images
- **Attachment tray + previews**: `packages/widget/src/core/attachments.js`
- **Template container**: `packages/widget/src/core/ui/template.html`
- **Message rendering**: `packages/widget/src/core/ui/messages.js` (text + markdown only; no image rendering)

Current limitations / TODOs observed
- No upload flow: attachments are base64 data URLs, but backend requires URL-only images.
- No image rendering in message bubbles (only text/markdown).
- Message history fetch ignores backend `images` payload and maps to `{ role, text }`.

Excerpt (message rendering ignores images):
```
function createMessageRow({ type, text }) {
  ...
  if (type === 'bot') {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }
  ...
}
```

---

## E) Blockers for UI work (Top 5)

1) **Image flow mismatch**: Widget sends base64 images, backend strips them (only URL images accepted).
2) **No upload call in widget**: `/api/upload` exists but unused, so images can’t be persisted or displayed.
3) **Message history drops images**: Widget maps API messages to `{ role, text }` only.
4) **Contracts vs backend image metadata mismatch**: backend stores `name/size/host`, contracts only define `url/type`.
5) **Widget README is out of sync**: references TSX/React files that are absent, risking confusion in UI changes.

---

## F) Next UI tasks (prioritized, 10 items)

1) Implement upload flow in widget: call `/api/upload`, then send returned `{ url, type, name, size }` to `/api/valki`.
2) Update widget message rendering to display image thumbnails for messages containing images.
3) Extend widget message history mapping to include `images` from `/api/messages`.
4) Align `ImageMeta` type across contracts/backend/widget (add optional `name`, `size`, `host` or formalize separate UI type).
5) Add UI feedback for upload errors (413 size, 400 invalid type) and retry option.
6) Update attachment preview to show upload progress and remove once uploaded (URL-based). 
7) Add strict validation in widget for `image/jpeg` and `image/png`, consistent with backend rules.
8) Add a unified image uploader utility in widget (shared by composer + any future gallery).
9) Ensure CSP-safe rendering for uploaded images in the widget template.
10) Refresh widget README to reflect current JS/ESBuild architecture (after code changes are complete).

---

## Evidence excerpts (paths)

1) `packages/contracts/src/index.ts` (ImageMeta + ImageMetadata alias)
```
export type { ImageMeta } from "./image.js";
export type { ImageMeta as ImageMetadata } from "./image.js";
```

2) `packages/bot/src/core/images.js` (base64 removal + URL gating)
```
const hasLegacyData = item?.dataUrl || item?.data;
if (hasLegacyData) {
  warnings.push("Removed legacy base64 image payload; only image URLs are supported.");
}

const url = cleanText(item?.url);
if (!isAllowedUrl(url)) continue;
```

3) `packages/widget/src/core/api.js` (askValki payload)
```
const payload = { message, clientId, images, agentId };
...
await fetch(config.apiValki, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload)
});
```

4) `packages/widget/src/core/attachments.js` (base64 attachments)
```
return (attachments || []).map((att) => ({
  name: att?.name || 'image',
  type: att?.type || 'image/jpeg',
  dataUrl: att?.dataUrl || ''
}));
```

5) `packages/bot/src/api/server.js` (upload route)
```
app.post("/api/upload", optionalAuth, (req, res) => {
  ...
  const meta = await storeUploadedFile({
    buffer: file.buffer,
    mime: normalizeMime(file.mimetype),
    name: file.originalname,
    size: file.size
  });
  return res.json({ url: publicUrl, mime: meta?.type, size: meta?.size, name: meta?.name });
});
```

---

## Output

AUDIT.md generated at repository root.
