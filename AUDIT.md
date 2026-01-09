# Project Audit Report (Vichat-monorepo)

Date: 2025-09-27

## Summary

**What works**
- Shared contracts package exports core domain types (Message, Conversation, User, ImageMeta) from a single barrel file, with an ImageMetadata alias for compatibility.
- Backend exposes an HTTP API with auth, message history, upload, and Valki inference routes; image normalization and storage are handled server-side.
- Widget builds via an esbuild pipeline, uploads attachments via `/api/upload`, and renders image thumbnails in message bubbles.

**What’s risky / unclear**
- Guest message history persists base64 `dataUrl` images locally and imports them to `/api/import-guest` without uploading; backend strips base64 payloads, so guest image history is lost on login.
- Backend uses both raw SQL (pg) and a Prisma schema; migrations exist, but runtime DB writes are done via `pg`, so Prisma-generated types may not reflect runtime usage.
- Bot responses that include images are not rendered or persisted in guest history because `/api/valki` response images are not passed into the UI renderer.
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

2) **Guest history import still sends base64 images.**
   - Guest history stores `dataUrl` values and imports them to `/api/import-guest`.
   - Backend sanitization removes `dataUrl` / `data` fields, so imported images are dropped.

**Minimal fix strategy**
- **Preferred**: Persist uploaded URLs in guest history (or upload during import) so `/api/import-guest` only receives URL-based images.
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
  - `POST /api/upload`
  - `POST /api/valki`
- Upload flow is used to convert local attachments into URL-based images before sending to `/api/valki`.

Excerpt (endpoint build):
```
return {
  baseUrl: trimmed,
  apiValki: `${trimmed}/api/valki`,
  apiUpload: `${trimmed}/api/upload`,
  apiMe: `${trimmed}/api/me`,
  apiMessages: `${trimmed}/api/messages`,
  apiClear: `${trimmed}/api/clear`,
  apiImportGuest: `${trimmed}/api/import-guest`,
  ...
};
```

### Payload shapes + contracts usage
- Types are imported from `@valki/contracts` via JSDoc.
- `askValki` payload includes `{ message, clientId, images, agentId }` with URL-based images returned by `/api/upload`.
- Attachments are stored locally as `{ name, type, dataUrl, file }` for preview; base64 data is not sent to `/api/valki`.

Excerpt (askValki payload):
```
const payload = { message, clientId, images: uploadedImages, agentId };
...
await fetch(config.apiValki, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload)
});
```

Excerpt (attachments snapshot includes dataUrl for preview only):
```
return (attachments || []).map((att) => ({
  name: att?.name || 'image',
  type: att?.type || 'image/jpeg',
  dataUrl: att?.dataUrl || '',
  file: att?.file
}));
```

Excerpt (upload flow to `/api/upload`):
```
const res = await fetch(config.apiUpload, {
  method: 'POST',
  headers: uploadHeaders,
  body: form
});
```

### UI components for images
- **Attachment tray + previews**: `packages/widget/src/core/attachments.js`
- **Template container**: `packages/widget/src/core/ui/template.html`
- **Message rendering**: `packages/widget/src/core/ui/messages.js` (text + markdown with image thumbnails)

Current limitations / TODOs observed
- Guest history import uses base64 `dataUrl` images when importing to `/api/import-guest`, so backend strips them and guest image history is lost on login.
- Bot responses that include `images` are not rendered or stored because `/api/valki` response images are not passed into the message renderer.
- Widget README remains out of sync with the actual JS/ESBuild structure.

Excerpt (message rendering includes images):
```
function createMessageRow({ type, text, images }) {
  ...
  if (Array.isArray(images) && images.length) {
    const attachmentTray = document.createElement('div');
    attachmentTray.className = 'valki-msg-attachments';
    ...
  }
  ...
}
```

---

## E) Blockers for UI work (Top 5)

1) **Guest image history import mismatch**: guest history stores base64 `dataUrl` images, and `/api/import-guest` strips them.
2) **Bot reply images not shown**: `/api/valki` response images are not passed into the UI renderer or guest history.
3) **Contracts vs backend image metadata mismatch**: backend stores `name/size/host`, contracts only define `url/type`.
4) **Widget README is out of sync**: references TSX/React files that are absent, risking confusion in UI changes.
5) **Guest history is still local-only**: `/api/messages` requires auth, so guest history remains client-side until login.

---

## F) Next UI tasks (prioritized, 10 items)

1) Persist uploaded image URLs in guest history and use them when importing to `/api/import-guest` (avoid base64 payloads).
2) If a guest history entry only has `dataUrl`, upload it during login import and replace with `{ url, type, name, size }`.
3) Pass `/api/valki` response images into `addMessage` and guest history persistence so bot attachments render.
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

3) `packages/widget/src/core/api.js` (upload flow + URL-based payload)
```
const res = await fetch(config.apiUpload, {
  method: 'POST',
  headers: uploadHeaders,
  body: form
});
...
const payload = { message, clientId, images: uploadedImages, agentId };
```

4) `packages/widget/src/core/attachments.js` (attachment snapshot)
```
return (attachments || []).map((att) => ({
  name: att?.name || 'image',
  type: att?.type || 'image/jpeg',
  dataUrl: att?.dataUrl || '',
  file: att?.file
}));
```

5) `packages/widget/src/core/ui/messages.js` (message image rendering)
```
if (Array.isArray(images) && images.length) {
  const attachmentTray = document.createElement('div');
  attachmentTray.className = 'valki-msg-attachments';
  ...
}
```

---

## Output

AUDIT.md generated at repository root.
