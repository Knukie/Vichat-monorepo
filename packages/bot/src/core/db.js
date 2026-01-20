import pg from "pg";
import { config, ensureSharedEnv } from "./config.js";
import { hostFromUrl, sanitizeImages, summarizeImageDiagnostics } from "./images.js";
import { cleanText, nowISO } from "./utils.js";

/** @typedef {import("@valki/contracts").ImageMeta} ImageMeta */
/** @typedef {import("@valki/contracts").Role} Role */

ensureSharedEnv();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function sanitizeJson(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => sanitizeJson(item))
      .filter((item) => item !== undefined);
    return cleaned;
  }

  if (value instanceof Date) return value.toISOString();

  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const cleaned = sanitizeJson(val);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }

  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return undefined;

  return value;
}

function normalizeImageUrlLengths(minLen, maxLen) {
  const toNumberOrNull = (v) => {
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  };

  return {
    min: toNumberOrNull(minLen),
    max: toNumberOrNull(maxLen)
  };
}

export async function ensureTablesExistOrThrow() {
  const qUsers = await pool.query("SELECT to_regclass('public.users') AS t");
  const q1 = await pool.query("SELECT to_regclass('public.conversations') AS t");
  const q2 = await pool.query("SELECT to_regclass('public.messages') AS t");

  if (!qUsers.rows?.[0]?.t || !q1.rows?.[0]?.t || !q2.rows?.[0]?.t) {
    throw new Error(
      "DB tables missing: create tables 'users', 'conversations', 'messages' in Railway UI (lowercase)."
    );
  }

  await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS images JSONB");
  await pool.query("ALTER TABLE messages ALTER COLUMN images SET DEFAULT '[]'::jsonb");
}

export async function getConversation(conversationId) {
  const conv = await pool.query("SELECT id, summary FROM conversations WHERE id = $1", [conversationId]);

  let summary = "";
  if (!conv.rows.length) {
    const ts = nowISO();
    await pool.query(
      "INSERT INTO conversations (id, summary, created_at, updated_at) VALUES ($1,$2,$3,$4)",
      [conversationId, "", ts, ts]
    );
  } else {
    summary = conv.rows[0].summary || "";
  }

  const msgs = await pool.query(
    "SELECT role, content, images FROM messages WHERE conversation_id = $1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 12",
    [conversationId]
  );

  return {
    summary,
    messages: (msgs.rows || [])
      .reverse()
      .map((m) => ({
        role: m.role,
        content: m.content,
        images: parseImages(m.images)
      }))
  };
}

function parseImages(raw) {
  let parsed = [];
  if (Array.isArray(raw)) {
    parsed = raw;
  } else if (raw) {
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json)) parsed = json;
    } catch {
      parsed = [];
    }
  }

  const { images } = sanitizeImages(parsed);
  return images;
}

function safeImagesForStorage(images = []) {
  const { images: sanitized, warnings } = sanitizeImages(images);
  const cleaned = sanitized
    .map((img) => {
      const out = {};
      const url = cleanText(img.url);
      if (url && !url.startsWith("data:")) out.url = url;

      const host = cleanText(img.host || "") || hostFromUrl(url);
      if (host) out.host = host;

      const type = cleanText(img.type);
      if (type) out.type = type;

      const name = cleanText(img.name);
      if (name) out.name = name;

      const size = Number(img.size);
      if (Number.isFinite(size) && size > 0) out.size = size;

      return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== ""));
    })
    .filter((img) => Object.keys(img).length > 0);

  return { images: cleaned, warnings };
}

function ensureJsonSafeImages(images) {
  try {
    JSON.stringify(images);
    return images;
  } catch (err) {
    console.warn("Dropping invalid image metadata:", err?.message || err);
    return [];
  }
}

/**
 * @param {string} conversationId
 * @param {Role} role
 * @param {string} content
 * @param {ImageMeta[]} images
 * @param {object} meta
 */
export async function saveMessage(conversationId, role, content, images = [], meta = {}) {
  const ts = nowISO();
  let safeImages = [];
  let warnings = [];
  let jsonPayload = "[]";

  try {
    const { images: storedImages, warnings: imageWarnings } = safeImagesForStorage(images);
    warnings = imageWarnings;
    const sanitizedImages = sanitizeJson(storedImages);
    const rawImages = Array.isArray(sanitizedImages) ? sanitizedImages : [];
    const filteredImages = rawImages.filter(
      (img) => img && typeof img === "object" && !Array.isArray(img)
    );
    safeImages = ensureJsonSafeImages(filteredImages);
    jsonPayload = JSON.stringify(safeImages ?? []);
  } catch (err) {
    console.warn("Failed to normalize images for storage:", err?.message || err);
    safeImages = [];
    warnings = [];
    jsonPayload = "[]";
  }

  if (warnings.length) {
    console.warn("Image warnings:", {
      conversationId,
      role,
      warnings
    });
  }

  if (process.env.DEBUG) {
    const firstHost =
      safeImages.find((img) => img?.host)?.host || hostFromUrl(safeImages[0]?.url || "");
    console.debug("[saveMessage] images", {
      conversationId,
      role,
      count: safeImages.length,
      firstHost: firstHost || null
    });
  }

  try {
    await pool.query(
      "INSERT INTO messages (conversation_id, role, content, images, ts) VALUES ($1,$2,$3,$4::jsonb,$5)",
      [conversationId, role, content, jsonPayload, ts]
    );
  } catch (err) {
    const diagnostics = summarizeImageDiagnostics(safeImages);
    const imageHosts = Array.isArray(diagnostics.hosts) ? diagnostics.hosts : [];
    const imageUrlLengths = normalizeImageUrlLengths(diagnostics.minUrlLength, diagnostics.maxUrlLength);
    const imagesValueType = Array.isArray(safeImages) ? "array" : typeof safeImages;
    const imagesPreview = jsonPayload ? jsonPayload.slice(0, 180) : "";
    console.error("saveMessage error:", {
      conversationId,
      role,
      textLen: cleanText(content).length,
      imageCount: safeImages.length,
      imageHosts,
      imageUrlLengths,
      imagesValueType,
      imagesPreview,
      requestId: meta?.requestId,
      message: err?.message || String(err)
    });
    throw err;
  }
}

export async function setConversationSummary(conversationId, summary) {
  const ts = nowISO();
  await pool.query("UPDATE conversations SET summary = $1, updated_at = $2 WHERE id = $3", [
    summary,
    ts,
    conversationId
  ]);
}

export async function upsertUserDiscord({ discordId, name }) {
  const provider = "discord";
  const provider_user_id = cleanText(discordId);
  const displayName = cleanText(name);
  const ts = nowISO();

  const found = await pool.query(
    "SELECT id FROM users WHERE provider = $1 AND provider_user_id = $2 LIMIT 1",
    [provider, provider_user_id]
  );

  if (found.rows?.length) {
    const uid = Number(found.rows[0].id);
    await pool.query("UPDATE users SET name = $1 WHERE id = $2", [displayName, uid]).catch(() => {});
    return uid;
  }

  const ins = await pool.query(
    "INSERT INTO users (provider, provider_user_id, name, created_at) VALUES ($1,$2,$3,$4) RETURNING id",
    [provider, provider_user_id, displayName, ts]
  );

  return Number(ins.rows[0].id);
}

export async function upsertUserGoogle({ googleSub, name }) {
  const provider = "google";
  const provider_user_id = cleanText(googleSub);
  const displayName = cleanText(name);
  const ts = nowISO();

  const found = await pool.query(
    "SELECT id FROM users WHERE provider = $1 AND provider_user_id = $2 LIMIT 1",
    [provider, provider_user_id]
  );

  if (found.rows?.length) {
    const uid = Number(found.rows[0].id);
    await pool.query("UPDATE users SET name = $1 WHERE id = $2", [displayName, uid]).catch(() => {});
    return uid;
  }

  const ins = await pool.query(
    "INSERT INTO users (provider, provider_user_id, name, created_at) VALUES ($1,$2,$3,$4) RETURNING id",
    [provider, provider_user_id, displayName, ts]
  );

  return Number(ins.rows[0].id);
}

export async function getOrCreateConversationForUser(userId) {
  const cid = `u-${userId}`;
  const conv = await pool.query("SELECT id FROM conversations WHERE id = $1 LIMIT 1", [cid]);

  if (!conv.rows?.length) {
    const ts = nowISO();
    await pool.query(
      "INSERT INTO conversations (id, summary, created_at, updated_at, user_id, customer_id) VALUES ($1,$2,$3,$4,$5,$6)",
      [cid, "", ts, ts, userId, userId]
    );
  } else {
    await pool
      .query(
        "UPDATE conversations SET user_id = $1, customer_id = $2 WHERE id = $3 AND (user_id IS NULL OR customer_id IS NULL)",
        [userId, userId, cid]
      )
      .catch(() => {});
  }

  return cid;
}
