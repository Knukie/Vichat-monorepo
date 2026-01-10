import express from "express";
import cors from "cors";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { cleanText, newConversationId, nowISO, pickPrimaryLocale } from "../core/utils.js";
import {
  htmlPopupDone,
  optionalAuth,
  requireAuth,
  signAuthToken,
  verifyAuthToken
} from "../core/auth.js";
import {
  ensureTablesExistOrThrow,
  getConversation,
  getOrCreateConversationForUser,
  saveMessage,
  upsertUserDiscord,
  upsertUserGoogle,
  pool
} from "../core/db.js";
import { normalizeRole } from "../core/contracts.js";
import { prepareGuestImportMessages } from "../core/importGuest.js";
import { runValki, ValkiModelError } from "../core/valki.js";
import { simpleRateLimit } from "../core/rateLimit.js";
import { config, corsOrigins, ensureApiEnv } from "../core/config.js";
import { ALLOWED_IMAGE_TYPES, sanitizeImages } from "../core/images.js";
import { MAX_IMAGE_BYTES, storeUploadedFile, uploadDir } from "../core/uploads.js";

ensureApiEnv();

const prisma = new PrismaClient();
const READY_TIMEOUT_MS = Number(process.env.READY_TIMEOUT_MS) || 2000;
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: config.JSON_BODY_LIMIT }));
app.use(
  "/uploads",
  express.static(uploadDir, {
    maxAge: "30d",
    setHeaders: (res) => res.setHeader("Cache-Control", "public, max-age=2592000, immutable")
  })
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"]
  })
);

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Image too large. Max 5 MB." });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }
  return next(err);
});

function toContractMessage(row, conversationId) {
  return {
    id: String(row?.id ?? ""),
    conversationId: String(conversationId || ""),
    role: normalizeRole(String(row?.role || "")),
    content: String(row?.content ?? ""),
    images: sanitizeImages(row?.images || []).images,
    ts: String(row?.ts ?? "")
  };
}

app.get("/", (_, res) => res.send("Valki Talki is live 🦅"));
app.get("/health", (_, res) =>
  res.json({
    ok: true,
    service: "valki-bot",
    env: config.NODE_ENV,
    uptime: Math.floor(process.uptime())
  })
);

app.get("/ready", async (_, res) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database readiness timeout")), READY_TIMEOUT_MS)
      )
    ]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    const message = e?.message || String(e);
    return res.status(503).json({ ok: false, error: message });
  }
});

app.get("/db/check", async (_, res) => {
  try {
    await ensureTablesExistOrThrow();
    const r = await pool.query("SELECT 1 as ok");
    res.json({ ok: true, db: r.rows?.[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get("/auth/discord", (req, res) => {
  const returnTo = cleanText(req.query.returnTo) || corsOrigins[0] || "https://valki.wiki";
  const state = signAuthToken({ rt: returnTo, n: crypto.randomBytes(8).toString("hex") }, 10 * 60);

  const params = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: config.DISCORD_REDIRECT_URI,
    scope: "identify",
    state
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get("/auth/discord/callback", async (req, res) => {
  try {
    const code = cleanText(req.query.code);
    const state = cleanText(req.query.state);

    if (!code || !state) return res.status(400).send("Missing code/state");

    const st = verifyAuthToken(state);
    const returnTo = cleanText(st?.rt) || corsOrigins[0] || "https://valki.wiki";
    const targetOrigin = corsOrigins.includes(returnTo) ? returnTo : corsOrigins[0] || "https://valki.wiki";

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        client_secret: config.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.DISCORD_REDIRECT_URI
      })
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text().catch(() => "");
      console.error("Discord token exchange failed:", tokenRes.status, t.slice(0, 300));
      return res.status(500).send("Discord auth failed");
    }

    const tokenJson = await tokenRes.json();
    const accessToken = cleanText(tokenJson?.access_token);
    if (!accessToken) return res.status(500).send("Discord auth failed");

    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!meRes.ok) return res.status(500).send("Discord user fetch failed");
    const me = await meRes.json();

    const discordId = cleanText(me?.id);
    const name = cleanText(me?.global_name) || cleanText(me?.username) || "Discord user";
    if (!discordId) return res.status(500).send("Discord user missing id");

    await ensureTablesExistOrThrow();

    const userId = await upsertUserDiscord({ discordId, name });
    await getOrCreateConversationForUser(userId);

    const authToken = signAuthToken({ uid: userId, name, provider: "discord" }, 60 * 60 * 24 * 14);

    return res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(
        htmlPopupDone({
          token: authToken,
          user: { id: userId, name, provider: "discord" },
          targetOrigin
        })
      );
  } catch (e) {
    console.error("Discord callback error:", e);
    return res.status(500).send("Auth error");
  }
});

app.get("/auth/google", (req, res) => {
  const returnTo = cleanText(req.query.returnTo) || corsOrigins[0] || "https://valki.wiki";
  const state = signAuthToken({ rt: returnTo, n: crypto.randomBytes(8).toString("hex") }, 10 * 60);

  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: config.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = cleanText(req.query.code);
    const state = cleanText(req.query.state);

    if (!code || !state) return res.status(400).send("Missing code/state");

    const st = verifyAuthToken(state);
    const returnTo = cleanText(st?.rt) || corsOrigins[0] || "https://valki.wiki";
    const targetOrigin = corsOrigins.includes(returnTo) ? returnTo : corsOrigins[0] || "https://valki.wiki";

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.GOOGLE_REDIRECT_URI
      })
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text().catch(() => "");
      console.error("Google token exchange failed:", tokenRes.status, t.slice(0, 500));
      return res.status(500).send("Google auth failed");
    }

    const tokenJson = await tokenRes.json();
    const idToken = cleanText(tokenJson?.id_token);
    if (!idToken) return res.status(500).send("Google auth failed (missing id_token)");

    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!infoRes.ok) {
      const t = await infoRes.text().catch(() => "");
      console.error("Google tokeninfo failed:", infoRes.status, t.slice(0, 300));
      return res.status(500).send("Google auth failed (bad id_token)");
    }

    const info = await infoRes.json();

    if (cleanText(info?.aud) !== cleanText(config.GOOGLE_CLIENT_ID)) {
      console.error("Google token aud mismatch:", { aud: info?.aud });
      return res.status(500).send("Google auth failed (aud mismatch)");
    }

    const sub = cleanText(info?.sub);
    const name = cleanText(info?.name) || cleanText(info?.email) || "Google user";

    if (!sub) return res.status(500).send("Google auth failed (missing sub)");

    await ensureTablesExistOrThrow();

    const userId = await upsertUserGoogle({ googleSub: sub, name });
    await getOrCreateConversationForUser(userId);

    const authToken = signAuthToken({ uid: userId, name, provider: "google" }, 60 * 60 * 24 * 14);

    return res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(
        htmlPopupDone({
          token: authToken,
          user: { id: userId, name, provider: "google" },
          targetOrigin
        })
      );
  } catch (e) {
    console.error("Google callback error:", e);
    return res.status(500).send("Auth error");
  }
});

app.get("/api/me", optionalAuth, (req, res) => {
  if (!req.user?.id) return res.json({ loggedIn: false });
  return res.json({ loggedIn: true, user: req.user });
});

function normalizeMime(mime) {
  const m = cleanText(mime || "").toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

function normalizePublicBaseUrl(baseUrl) {
  const cleaned = cleanText(baseUrl).replace(/\/+$/, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("http://")) return `https://${cleaned.slice("http://".length)}`;
  return cleaned;
}

function ensureAbsolutePublicUrl(req, url) {
  const cleaned = cleanText(url);
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === "https:") return parsed.toString();
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
      return parsed.toString();
    }
  } catch {
    // fall through
  }

  const baseFromConfig = normalizePublicBaseUrl(config.PUBLIC_UPLOAD_BASE_URL || config.UPLOAD_BASE_URL);
  let base = baseFromConfig;
  if (!base) {
    const forwardedHost = cleanText(req.headers["x-forwarded-host"]);
    const host = forwardedHost || cleanText(req.headers.host);
    const forwardedProto = cleanText(req.headers["x-forwarded-proto"]);
    const proto = forwardedProto || req.protocol || "https";
    const safeProto = proto === "http" ? "https" : proto;
    if (host) base = `${safeProto}://${host}`;
  }
  if (!base) return "";

  const path = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return `${base.replace(/\/+$/, "")}${path}`;
}

function pickIncomingImageList(body) {
  const incoming = Array.isArray(body?.images) ? body.images : [];
  const legacy = Array.isArray(body?.attachments) ? body.attachments : [];
  return incoming.length ? incoming : legacy;
}

function normalizeIncomingImageUrls(list, req) {
  const normalized = [];
  const seen = new Set();

  for (const item of Array.isArray(list) ? list : []) {
    const candidate =
      typeof item === "string" ? item : cleanText(item?.url || item?.image_url || item?.src);
    const cleaned = cleanText(candidate);
    if (!cleaned) continue;
    if (cleaned.startsWith("data:") || cleaned.startsWith("blob:")) continue;

    const resolved = cleaned.startsWith("/") ? ensureAbsolutePublicUrl(req, cleaned) : cleaned;
    if (!resolved) continue;

    try {
      const parsed = new URL(resolved);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const normalizedUrl = parsed.toString();
      if (seen.has(normalizedUrl)) continue;
      const name = typeof item === "object" ? cleanText(item?.name) : "";
      const type = typeof item === "object" ? normalizeMime(item?.type) : "";
      const size = typeof item === "object" ? Number(item?.size) : NaN;
      const entry = { url: normalizedUrl };
      if (name) entry.name = name;
      if (type) entry.type = type;
      if (Number.isFinite(size)) entry.size = size;
      normalized.push(entry);
      seen.add(normalizedUrl);
    } catch {
      continue;
    }
  }

  return normalized;
}

function responseImages(images = []) {
  return (Array.isArray(images) ? images : [])
    .map((img) => ({
      url: cleanText(img?.url),
      name: cleanText(img?.name),
      type: cleanText(img?.type) || "external",
      size: Number(img?.size) || undefined
    }))
    .filter((img) => !!img.url);
}


async function parseMultipartImage(req) {
  const contentType = cleanText(req.headers["content-type"]);
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    req.resume();
    return { error: "Invalid upload form." };
  }

  const boundary = boundaryMatch[1];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const chunks = [];
  let total = 0;
  let tooBig = false;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_IMAGE_BYTES + 200_000) {
      tooBig = true;
      continue;
    }
    if (!tooBig) chunks.push(chunk);
  }
  if (tooBig) return { error: "Image too large. Max 5 MB." };

  const data = Buffer.concat(chunks);
  const firstBoundaryIndex = data.indexOf(boundaryBuffer);
  if (firstBoundaryIndex === -1) return { error: "Invalid upload form." };

  const headersStart = firstBoundaryIndex + boundaryBuffer.length + 2; // skip CRLF
  const headerSeparator = Buffer.from("\r\n\r\n");
  const headersEnd = data.indexOf(headerSeparator, headersStart);
  if (headersEnd === -1) return { error: "Invalid upload form." };

  const headersText = data.slice(headersStart, headersEnd).toString("utf8");
  const dispositionMatch = headersText.match(/name="([^"]+)"/i);
  const filenameMatch = headersText.match(/filename="([^"]*)"/i);
  const contentTypeMatch = headersText.match(/content-type:\s*([^\r\n]+)/i);

  const fieldName = cleanText(dispositionMatch?.[1]);
  if (fieldName !== "file") return { error: "Image file required." };

  const fileStart = headersEnd + headerSeparator.length;
  const endBoundary = Buffer.from(`\r\n--${boundary}--`);
  let fileEnd = data.indexOf(endBoundary, fileStart);
  if (fileEnd === -1) {
    const altBoundary = Buffer.from(`\r\n--${boundary}\r\n`);
    fileEnd = data.indexOf(altBoundary, fileStart);
  }
  if (fileEnd === -1) return { error: "Invalid upload form." };

  const fileBuffer = data.slice(fileStart, fileEnd);
  const mime = normalizeMime(contentTypeMatch?.[1] || "");
  if (!ALLOWED_IMAGE_TYPES.has(mime)) return { error: "Only JPEG/PNG supported." };
  if (!fileBuffer.length) return { error: "Image file required." };
  if (fileBuffer.length > MAX_IMAGE_BYTES) return { error: "Image too large. Max 5 MB." };

  const originalname = cleanText(filenameMatch?.[1]) || "upload";

  return {
    file: {
      buffer: fileBuffer,
      mimetype: mime,
      originalname,
      size: fileBuffer.length
    }
  };
}

app.post("/api/upload", optionalAuth, (req, res) => {
  const requestId = crypto.randomUUID();

  parseMultipartImage(req)
    .then(async (parsed) => {
      if (parsed?.error) {
        const status = parsed.error.includes("5 MB") ? 413 : 400;
        return res.status(status).json({ error: parsed.error });
      }

      try {
        const file = parsed?.file;
        if (!file) return res.status(400).json({ error: "Image file required." });

        const meta = await storeUploadedFile({
          buffer: file.buffer,
          mime: normalizeMime(file.mimetype),
          name: file.originalname,
          size: file.size
        });
        const publicUrl = ensureAbsolutePublicUrl(req, meta?.url) || cleanText(meta?.url);

        console.info("[upload] stored", {
          requestId,
          mime: meta?.type,
          size: meta?.size,
          user: req.user?.id ? "auth" : "guest"
        });

        return res.json({ url: publicUrl, mime: meta?.type, size: meta?.size, name: meta?.name });
      } catch (e) {
        const msg = e?.message || String(e);
        const status = msg.includes("5 MB") ? 413 : 500;
        console.error("/api/upload error:", { requestId, message: msg });
        return res.status(status).json({ error: "Upload failed.", requestId });
      }
    })
    .catch((e) => {
      console.error("/api/upload unexpected error:", { requestId, message: e?.message || e });
      return res.status(500).json({ error: "Upload failed.", requestId });
    });
});

app.get("/api/messages", optionalAuth, async (req, res) => {
  try {
    await ensureTablesExistOrThrow();

    const requestedCid = cleanText(req.query.conversationId);

    let cid = "";
    if (req.user?.id) {
      cid = await getOrCreateConversationForUser(req.user.id);
    } else if (requestedCid) {
      const conv = await pool.query("SELECT user_id FROM conversations WHERE id = $1 LIMIT 1", [
        requestedCid
      ]);

      const ownerId = Number(conv?.rows?.[0]?.user_id) || null;
      if (ownerId) return res.status(401).json({ error: "Login required for this conversation" });

      cid = requestedCid;
    } else {
      return res.status(400).json({ error: "conversationId required for guests" });
    }

    const r = await pool.query(
      "SELECT id, role, content, images, ts FROM messages WHERE conversation_id = $1 AND deleted_at IS NULL ORDER BY id ASC LIMIT 200",
      [cid]
    );

    const messages = (r.rows || []).map((m) => toContractMessage(m, cid));

    return res.json({ conversationId: cid, messages });
  } catch (e) {
    console.error("/api/messages error:", e);
    return res.status(500).json({ error: "Internal backend error" });
  }
});

app.delete("/api/message/:id", requireAuth, async (req, res) => {
  try {
    await ensureTablesExistOrThrow();
    const mid = Number(req.params.id);
    if (!Number.isFinite(mid)) return res.status(400).json({ error: "Bad message id" });

    const cid = await getOrCreateConversationForUser(req.user.id);

    const check = await pool.query(
      "SELECT id FROM messages WHERE id = $1 AND conversation_id = $2 AND deleted_at IS NULL LIMIT 1",
      [mid, cid]
    );

    if (!check.rows?.length) return res.status(404).json({ error: "Not found" });

    await pool.query("UPDATE messages SET deleted_at = $1 WHERE id = $2", [nowISO(), mid]);
    return res.json({ ok: true });
  } catch (e) {
    console.error("DELETE message error:", e);
    return res.status(500).json({ error: "Internal backend error" });
  }
});

app.post("/api/clear", requireAuth, async (req, res) => {
  try {
    await ensureTablesExistOrThrow();
    const cid = await getOrCreateConversationForUser(req.user.id);

    await pool.query(
      "UPDATE messages SET deleted_at = $1 WHERE conversation_id = $2 AND deleted_at IS NULL",
      [nowISO(), cid]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("/api/clear error:", e);
    return res.status(500).json({ error: "Internal backend error" });
  }
});

app.post("/api/import-guest", requireAuth, async (req, res) => {
  try {
    await ensureTablesExistOrThrow();

    const items = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!items.length) return res.json({ ok: true, imported: 0 });

    const cleaned = await prepareGuestImportMessages(items);

    if (!cleaned.length) return res.json({ ok: true, imported: 0 });

    const cid = await getOrCreateConversationForUser(req.user.id);

    for (const m of cleaned) {
      await saveMessage(cid, m.role, m.content, m.images || []);
    }

    return res.json({ ok: true, imported: cleaned.length });
  } catch (e) {
    console.error("/api/import-guest error:", e);
    return res.status(500).json({ ok: false, error: "Import failed" });
  }
});

app.use("/api/valki", simpleRateLimit({ windowMs: 60_000, max: 60 }));

app.post("/api/valki", optionalAuth, async (req, res) => {
  const requestId = crypto.randomUUID();
  let responseConversationId = "";
  try {
    const body = req.body || {};
    const { message, conversationId, locale, clientId } = body;
    const userMessage = typeof message === "string" ? message : "";
    const incomingConversationId = cleanText(conversationId);
    const headerLocale = pickPrimaryLocale(req.headers["accept-language"]);
    const preferredLocale = cleanText(locale) || headerLocale;

    const incomingList = pickIncomingImageList(body);
    const imagesType = Array.isArray(body?.images) ? "array" : typeof body?.images;
    const contentLength = cleanText(req.headers["content-length"]);
    console.info("[valki] body", {
      requestId,
      keys: Object.keys(body),
      hasImages: incomingList.length > 0,
      imagesType,
      imagesLen: incomingList.length,
      contentLength
    });

    const normalizedIncoming = normalizeIncomingImageUrls(incomingList, req);
    const { images: normalizedImages, warnings: imageWarnings } = sanitizeImages(normalizedIncoming);
    const attemptedImages = incomingList.length;
    const dropped = Math.max(0, attemptedImages - normalizedIncoming.length);
    const imageHosts = normalizedImages.map((img) => img.host).filter(Boolean);
    const imageUrlLengths = normalizedImages.map((img) => (img?.url || "").length);

    console.info("[valki] images", {
      requestId,
      received: attemptedImages,
      normalized: normalizedIncoming.length,
      dropped,
      finalCount: normalizedImages.length,
      hosts: Array.from(new Set(imageHosts)),
      urlLengths: imageUrlLengths
    });

    await ensureTablesExistOrThrow();

    const hasText = !!cleanText(userMessage);
    const hasImages = normalizedImages.length > 0;

    let cid = "";
    if (req.user?.id) {
      cid = await getOrCreateConversationForUser(req.user.id);
    } else if (incomingConversationId) {
      cid = incomingConversationId;
      await getConversation(cid);
    } else {
      cid = newConversationId();
    }
    responseConversationId = cid;

    if (!hasText && !hasImages) {
      const errorMessage = attemptedImages
        ? "Invalid image payload. Send image URLs only."
        : "Message or image required.";
      return res.status(400).json({ ok: false, message: errorMessage, conversationId: cid });
    }

    if (!hasImages && attemptedImages > 0) {
      return res.status(400).json({
        ok: false,
        message: "ksshh… I couldn't read that image. Please try a JPEG/PNG under 5MB.",
        conversationId: cid
      });
    }

    console.info("[valki] request", {
      requestId,
      conversationId: cid,
      clientId: cleanText(clientId),
      hasText,
      images: normalizedImages.length,
      imageHosts: Array.from(new Set(imageHosts)),
      imageUrlLengths
    });

    const userTextForRun = hasText ? userMessage : "[image]";

    const { reply, assistantImages } = await runValki({
      userText: userTextForRun,
      conversationId: cid,
      preferredLocale,
      images: normalizedImages,
      requestId
    });

    const responseBody = { ok: true, message: reply, conversationId: cid };
    const cleanedImages = responseImages(normalizedImages);
    if (cleanedImages.length) responseBody.images = cleanedImages;
    if (assistantImages?.length) responseBody.assistantImages = assistantImages;
    if (imageWarnings.length) responseBody.warnings = Array.from(new Set(imageWarnings));

    return res.json(responseBody);
  } catch (err) {
    if (err instanceof ValkiModelError) {
      console.error("/api/valki OpenAI error:", { requestId, message: err.message });
      return res.status(502).json({
        ok: false,
        message: "Temporary error analyzing image.",
        conversationId: responseConversationId || cleanText(req.body?.conversationId) || newConversationId(),
        requestId
      });
    }
    console.error("/api/valki error:", { requestId, message: err?.message || err });
    return res.status(500).json({
      ok: false,
      message: "ksshh… Internal backend error",
      conversationId: responseConversationId || cleanText(req.body?.conversationId) || newConversationId(),
      requestId
    });
  }
});

const port = Number(config.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`🌐 HTTP API running on port ${port} (${config.NODE_ENV})`);
});

let isShuttingDown = false;
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try {
    console.log(`\n🧯 Shutdown (${signal})...`);
    await new Promise((resolve) => server?.close?.(resolve));
    console.log("HTTP server closed.");
    await prisma.$disconnect().then(
      () => console.log("Prisma disconnected."),
      (err) => console.warn("Prisma disconnect failed:", err?.message || err)
    );
    await pool.end().then(
      () => console.log("Postgres pool closed."),
      (err) => console.warn("Postgres pool close failed:", err?.message || err)
    );
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
