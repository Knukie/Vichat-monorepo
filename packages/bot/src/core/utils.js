import crypto from "crypto";

export const MSG_LOST = "🦅 krrt… lost signal. Say that again?";
export const MSG_STATIC = "🦅 krrzzzt… static on the line. Try again.";
export const MSG_MENTION_ONLY = "🦅 krrt… I heard my name, but I need a question too.";
export const AUTH_POSTMESSAGE_TYPE = "valki_auth";

export function cleanText(input) {
  const withoutNulls = String(input ?? "").replaceAll("\u0000", "");
  return withoutNulls.trim();
}

export function nowISO() {
  return new Date().toISOString();
}

export function newConversationId() {
  return crypto.randomBytes(12).toString("hex");
}

export function pickPrimaryLocale(acceptLanguageHeader) {
  const h = cleanText(acceptLanguageHeader);
  if (!h) return "";

  const parts = h.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "";

  let best = { tag: "", q: -1 };

  for (const part of parts) {
    const segs = part.split(";").map((x) => x.trim()).filter(Boolean);
    const tag = segs[0] || "";
    if (!tag) continue;

    let q = 1;
    for (const s of segs.slice(1)) {
      const m = s.match(/^q=([0-9.]+)$/i);
      if (m) q = Number(m[1]) || 0;
    }

    if (q > best.q) best = { tag, q };
  }

  return best.tag || parts[0].split(";")[0].trim() || "";
}

export function localeInstruction(locale) {
  const l = cleanText(locale);
  if (!l) return "";
  return `Respond in the language indicated by the user's locale: "${l}".`;
}

export function languageRule(userText, preferredLocale = "") {
  const loc = cleanText(preferredLocale);
  if (loc) return localeInstruction(loc);
  return "Respond in the same language as the user.";
}

export function isValkiTopic(userText) {
  const s = cleanText(userText).toLowerCase();
  return /\bvalki\b/.test(s) || /\bvalkitalki\b/.test(s) || s.includes("app.iqai.com");
}

export function extractTextFromResponse(resp) {
  const direct = cleanText(resp?.output_text);
  if (direct) return direct;

  const parts = [];
  for (const item of resp?.output || []) {
    if (item?.type === "message") {
      for (const c of item?.content || []) {
        if (c?.type === "output_text" && c?.text) parts.push(c.text);
      }
    }
  }
  return cleanText(parts.join("\n"));
}

export function safeLogOpenAIError(err) {
  const status = err?.status || err?.response?.status;
  const code = err?.code || err?.error?.code;
  const message =
    err?.message ||
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    String(err);

  console.error("OpenAI error:", { status, code, message });
}

export function chunkDiscord(text) {
  const s = cleanText(text);
  const out = [];
  for (let i = 0; i < s.length; i += 1900) out.push(s.slice(i, i + 1900));
  return out.length ? out : [MSG_LOST];
}

export function sanitizeJSON(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => sanitizeJSON(item))
      .filter((item) => item !== undefined && item !== null);
    return cleaned;
  }

  if (value instanceof Date) return value.toISOString();

  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const cleaned = sanitizeJSON(val);
      if (cleaned !== undefined && cleaned !== null) out[key] = cleaned;
    }
    return out;
  }

  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return null;

  return value;
}
