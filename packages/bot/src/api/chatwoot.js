import { Router } from "express";
import { cleanText } from "../core/utils.js";

const CHATWOOT_API_PREFIX = "/app/v1";

const chatwootRouter = Router();

// -----------------------
// Helpers
// -----------------------
function ok(res) {
  return res.status(200).json({ ok: true });
}

function stripHtml(html = "") {
  return String(html).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function normalizeBaseUrl(url) {
  return cleanText(url).replace(/\/+$/, "");
}

function getHeader(req, name) {
  const target = String(name || "").toLowerCase();
  const headers = req?.headers || {};
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === target) return v;
  }
  return undefined;
}

function pickChatwootText(payload) {
  const processed = cleanText(payload?.processed_message_content);
  if (processed) return processed;
  return stripHtml(payload?.content || "");
}

function pickChatwootLocale(payload) {
  return (
    cleanText(payload?.conversation?.additional_attributes?.browser?.browser_language) ||
    cleanText(payload?.conversation?.meta?.sender?.browser_language) ||
    ""
  );
}

function pickChatwootImages(payload) {
  const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
  return attachments
    .filter((a) => cleanText(a?.file_type) === "image")
    .map((a) => ({
      url: cleanText(a?.data_url) || cleanText(a?.url) || cleanText(a?.file_url),
      type: cleanText(a?.content_type)
    }))
    .filter((img) => !!img.url);
}

async function callLocalValkiAPI({ baseUrl, message, conversationId, locale, images }) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) throw new Error("PUBLIC_SELF_BASE_URL missing/empty");

  const resp = await fetch(`${base}/api/valki`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationId, locale, images })
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const errMsg = cleanText(json?.error) || `Valki API error (${resp.status})`;
    throw new Error(errMsg);
  }

  return json;
}

async function postChatwootMessage({ chatwootBaseUrl, apiToken, accountId, conversationId, text }) {
  const base = normalizeBaseUrl(chatwootBaseUrl);
  const token = cleanText(apiToken);

  if (!base) throw new Error("CHATWOOT_BASE_URL missing/empty");
  if (!token) throw new Error("CHATWOOT_API_TOKEN missing/empty");

  const url = `${base}/app/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

  // Debug zonder secrets te loggen
  console.info("[chatwoot] send debug", {
    base,
    accountId,
    conversationId,
    tokenLen: token.length
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",

      // Primary auth (werkt met curl.exe bij jou)
      api_access_token: token,

      // Fallback auth (handig achter proxies)
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      content: text,
      message_type: "outgoing",
      private: false,
      content_type: "text"
    })
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Chatwoot send failed: ${resp.status} ${t.slice(0, 500)}`);
  }

  return resp.json().catch(() => ({}));
}

// -----------------------
// Webhook
// -----------------------
chatwootRouter.post("/webhook", async (req, res) => {
  const payload = req.body ?? {};

  try {
    // Optional: verify webhook calls really come from Chatwoot
    // (only enforced if CHATWOOT_BOT_TOKEN is set)
    const expectedBotToken = cleanText(process.env.CHATWOOT_BOT_TOKEN);
    if (expectedBotToken) {
      const provided =
        cleanText(getHeader(req, "x-chatwoot-bot-token")) ||
        cleanText(getHeader(req, "x-chatwoot-token")) ||
        cleanText(getHeader(req, "authorization"));

      if (!provided || provided !== expectedBotToken) {
        console.warn("[chatwoot] invalid bot token");
        return res.status(401).json({ ok: false });
      }
    }

    // Filters to avoid noise/loops
    if (payload?.event !== "message_created") return ok(res);
    if (payload?.message_type !== "incoming") return ok(res);
    if (payload?.private === true) return ok(res);

    const text = pickChatwootText(payload);

    // Skip long HTML welcome templates
    if (!cleanText(payload?.processed_message_content) && text.length > 200) {
      console.info("[chatwoot] skipped long html template");
      return ok(res);
    }

    const accountId = payload?.account?.id;
    const conversationIdRaw = payload?.conversation?.id ?? payload?.conversation_id;

    if (!accountId || !conversationIdRaw) {
      console.warn("[chatwoot] missing accountId/conversationId");
      return ok(res);
    }

    const valkiConversationId = `cw:${conversationIdRaw}`;
    const locale = pickChatwootLocale(payload);
    const images = pickChatwootImages(payload);

    console.info("[chatwoot] incoming", {
      accountId,
      conversationId: conversationIdRaw,
      valkiConversationId,
      textLen: text.length,
      images: images.length
    });

    const publicSelfBaseUrl = normalizeBaseUrl(process.env.PUBLIC_SELF_BASE_URL) || "https://auth.valki.wiki";
    const chatwootBaseUrl = normalizeBaseUrl(process.env.CHATWOOT_BASE_URL);
    const chatwootApiToken = cleanText(process.env.CHATWOOT_API_TOKEN);

    const valkiJson = await callLocalValkiAPI({
      baseUrl: publicSelfBaseUrl,
      message: text || (images.length ? "[image]" : ""),
      conversationId: valkiConversationId,
      locale,
      images
    });

    const reply =
      cleanText(valkiJson?.reply) ||
      cleanText(valkiJson?.message) ||
      "Ik kan hier nog niet op reageren.";

    console.info("[chatwoot] valki reply", { len: reply.length });

    await postChatwootMessage({
      chatwootBaseUrl,
      apiToken: chatwootApiToken,
      accountId,
      conversationId: conversationIdRaw,
      text: reply
    });

    return ok(res);
  } catch (e) {
    console.error("❌ chatwoot webhook error:", e?.message || e);
    // Always return 200 to avoid retries/loops
    return ok(res);
  }
});

export { chatwootRouter };
