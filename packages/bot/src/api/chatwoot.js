import { Router } from "express";
import { cleanText } from "../core/utils.js";

const chatwootRouter = Router();

function stripHtml(html = "") {
  return String(html).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function pickChatwootText(payload) {
  const processed = cleanText(payload?.processed_message_content);
  if (processed) return processed;
  return stripHtml(payload?.content || "");
}

function pickChatwootLocale(payload) {
  // chatwoot webwidget zet vaak browser_language in additional_attributes
  const lang = cleanText(
    payload?.conversation?.additional_attributes?.browser?.browser_language
  );
  return lang || "";
}

function pickChatwootImages(payload) {
  const attachments = Array.isArray(payload?.attachments) ? payload.attachments : [];
  return attachments
    .filter((a) => cleanText(a?.file_type) === "image")
    .map((a) => ({
      url: cleanText(a?.data_url),     // chatwoot geeft meestal data_url
      type: cleanText(a?.content_type) // bijv image/jpeg
    }))
    .filter((img) => !!img.url);
}

async function callLocalValkiAPI({ baseUrl, message, conversationId, locale, images }) {
  // baseUrl = jouw eigen service URL, bv https://auth.valki.wiki
  const resp = await fetch(`${baseUrl}/api/valki`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversationId,
      locale,
      images
    })
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const errMsg = cleanText(json?.error) || `Valki API error (${resp.status})`;
    throw new Error(errMsg);
  }
  return json; // verwacht: { reply/message, ... }
}

async function postChatwootMessage({ chatwootBaseUrl, apiToken, accountId, conversationId, text }) {
  const url = `${chatwootBaseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      api_access_token: apiToken
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
    throw new Error(`Chatwoot send failed: ${resp.status} ${t.slice(0, 400)}`);
  }
}

chatwootRouter.post("/webhook", async (req, res) => {
  const payload = req.body ?? {};

  try {
    // ✅ filters tegen loops & ruis
    if (payload.event !== "message_created") return res.status(200).json({ ok: true });
    if (payload.message_type !== "incoming") return res.status(200).json({ ok: true });
    if (payload.private === true) return res.status(200).json({ ok: true });

    const text = pickChatwootText(payload);

    // Skip lange “welcome template” HTML zonder echte user tekst
    if (!cleanText(payload?.processed_message_content) && text.length > 200) {
      console.info("[chatwoot] skipped long html template");
      return res.status(200).json({ ok: true });
    }

    const accountId = payload?.account?.id;
    const conversationIdRaw = payload?.conversation?.id ?? payload?.conversation_id;
    if (!accountId || !conversationIdRaw) {
      console.warn("[chatwoot] missing accountId/conversationId");
      return res.status(200).json({ ok: true });
    }

    // ✅ voorkom clash met jouw eigen conversation ids
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

    // ✅ roep jouw bestaande Valki HTTP pipeline aan
    const publicSelfBaseUrl =
      cleanText(process.env.PUBLIC_SELF_BASE_URL) || "https://auth.valki.wiki";

    const valkiJson = await callLocalValkiAPI({
      baseUrl: publicSelfBaseUrl,
      message: text || (images.length ? "[image]" : ""),
      conversationId: valkiConversationId,
      locale,
      images
    });

    const reply =
      cleanText(valkiJson?.reply) || cleanText(valkiJson?.message) || "Ik kan hier nog niet op reageren.";

    console.info("[chatwoot] valki reply", { len: reply.length });

    // ✅ post terug naar chatwoot
    await postChatwootMessage({
      chatwootBaseUrl: cleanText(process.env.CHATWOOT_BASE_URL),
      apiToken: cleanText(process.env.CHATWOOT_API_TOKEN),
      accountId,
      conversationId: conversationIdRaw,
      text: reply
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("❌ chatwoot webhook error:", e?.message || e);
    // altijd 200 om retries/loops te voorkomen
    return res.status(200).json({ ok: true });
  }
});

export { chatwootRouter };
