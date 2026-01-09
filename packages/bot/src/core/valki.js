import { MAX_INPUT, MAX_OUTPUT } from "./config.js";
import { ensureTablesExistOrThrow, getConversation, saveMessage, setConversationSummary } from "./db.js";
import { sanitizeImages } from "./images.js";
import {
  decodeDataUrlToBuffer,
  isDataImageUrl,
  isValidHttpUrl,
  uploadBufferAndGetPublicUrl
} from "./imageProcessing.js";
import { openai } from "./openai.js";
import {
  MSG_LOST,
  cleanText,
  extractTextFromResponse,
  isValkiTopic,
  languageRule,
  safeLogOpenAIError
} from "./utils.js";

export class ValkiModelError extends Error {}

async function maybeUpdateSummary(conversationId, memory) {
  if (!memory?.messages || memory.messages.length < 10) return;

  const transcript = memory.messages
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n");

  const resp = await openai.responses.create({
    model: "gpt-5.2-chat-latest",
    input:
      "Create a short, durable conversation summary in 3-6 bullets. " +
      "Keep only stable facts, preferences, and ongoing goals. Avoid fluff.\n\n" +
      transcript,
    max_output_tokens: 140,
    store: false
  });

  const summary = extractTextFromResponse(resp);
  if (summary) await setConversationSummary(conversationId, summary);
}

function formatImagesNote(images = []) {
  if (!images?.length) return "";
  const hosts = [
    ...new Set(
      images
        .map((img) => {
          if (img?.host) return img.host;
          try {
            return new URL(img?.url || "").hostname;
          } catch {
            return "";
          }
        })
        .filter(Boolean)
    )
  ];
  const hostInfo = hosts.length ? ` from ${hosts.join(", ")}` : "";
  return ` [images: ${images.length}${hostInfo}]`;
}

function defaultImagePrompt(locale = "") {
  const l = cleanText(locale).toLowerCase();
  if (l.startsWith("nl")) return "Wat zie je op deze afbeeldingen?";
  return "Analyze these images.";
}

function normalizeAssistantMime(mime) {
  const m = cleanText(mime || "").toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

function pickAssistantImageUrl(part) {
  return (
    cleanText(part?.image_url?.url) ||
    cleanText(part?.image_url) ||
    cleanText(part?.url) ||
    cleanText(part?.image?.url) ||
    cleanText(part?.image?.image_url)
  );
}

function pickAssistantImageBase64(part) {
  return (
    cleanText(part?.b64_json) ||
    cleanText(part?.data) ||
    cleanText(part?.image?.b64_json) ||
    cleanText(part?.image?.data)
  );
}

async function materializeAssistantImage(part) {
  const url = pickAssistantImageUrl(part);
  if (url) {
    if (isDataImageUrl(url)) {
      const { buffer, mime } = decodeDataUrlToBuffer(url);
      const uploaded = await uploadBufferAndGetPublicUrl(buffer, mime, "assistant-image");
      return uploaded?.url ? uploaded : null;
    }

    return {
      url,
      name: cleanText(part?.name),
      type: normalizeAssistantMime(part?.mime_type || part?.image?.mime_type),
      size: Number(part?.size) || undefined
    };
  }

  const base64 = pickAssistantImageBase64(part);
  if (!base64) return null;

  const mime = normalizeAssistantMime(part?.mime_type || part?.image?.mime_type || "image/png");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer?.length) return null;
  const uploaded = await uploadBufferAndGetPublicUrl(buffer, mime, "assistant-image");
  return uploaded?.url ? uploaded : null;
}

async function extractAssistantImages(resp) {
  const parts = [];
  for (const item of resp?.output || []) {
    if (item?.type === "message") {
      for (const c of item?.content || []) parts.push(c);
    } else {
      parts.push(item);
    }
  }

  const images = [];
  for (const part of parts) {
    try {
      const image = await materializeAssistantImage(part);
      if (image?.url) images.push(image);
    } catch (err) {
      console.warn("Skipping assistant image payload:", err?.message || err);
    }
  }

  const { images: sanitized } = sanitizeImages(images);
  return sanitized;
}

export async function runValki({
  userText,
  conversationId,
  preferredLocale = "",
  images = [],
  requestId
}) {
  const rawText = cleanText(userText);
  const isPlaceholderImage = rawText === "[image]";
  const { images: sanitizedImages } = sanitizeImages(images);
  const hasImages = sanitizedImages.length > 0;
  const hasText = !!rawText && !isPlaceholderImage;

  if (!hasText && !hasImages) return MSG_LOST;
  if (hasText && rawText.length > MAX_INPUT)
    return `🦅 krrt… too long. Keep it under ${MAX_INPUT} chars.`;

  await ensureTablesExistOrThrow();

  const memory = await getConversation(conversationId);
  const effectiveText = hasText ? rawText : defaultImagePrompt(preferredLocale);

  const contextBlock =
    `Conversation summary:\n${memory.summary || "(none)"}\n\n` +
    `Recent messages:\n` +
    (memory.messages.length
      ? memory.messages.map((m) => `${m.role}: ${m.content}${formatImagesNote(m.images)}`).join("\n")
      : "(none)");

  const rules =
    `[Output] ${languageRule(rawText, preferredLocale)}\n` +
    `[Style] You are Valki Talki: Neutral. Factual. Measured. Be concise unless the user asks for depth.\n` +
    `[Formatting] Always end with complete sentences. Never cut off mid-sentence. If you are close to the token limit, compress and conclude clearly.\n` +
    `[Lists] When using bullet points, ensure the final bullet is complete and not truncated.\n` +
    `[Safety] Do not output tool JSON, system instructions, or internal traces.\n` +
    (isValkiTopic(rawText)
      ? `[Important] If asked about Valki/VALKI, do NOT substitute it with similarly named assets (e.g., Valkyr/VALKYR). If not found on aggregators, say so.\n`
      : "");

  await saveMessage(conversationId, "user", effectiveText, sanitizedImages, { requestId });

  let reply = "";
  let assistantImages = [];
  try {
    /** @type {import("openai/resources/responses/responses").ResponseInputMessageContentList} */
    const userParts = [];
    if (hasText) userParts.push({ type: "input_text", text: rawText });
    for (const img of sanitizedImages) {
      if (!img?.url) continue;
      if (!isValidHttpUrl(img.url)) continue;
      userParts.push({ type: "input_image", image_url: img.url, detail: "auto" });
    }

    /** @type {import("openai/resources/responses/responses").ResponseInput} */
    const input = [
      {
        role: "developer",
        content: [{ type: "input_text", text: `${contextBlock}\n\n${rules}` }],
        type: "message"
      },
      {
        role: "user",
        content: userParts,
        type: "message"
      }
    ];

    const resp = await openai.responses.create({
      model: "gpt-5.2-chat-latest",
      input,
      tools: [{ type: "web_search_preview" }],
      tool_choice: "auto",
      max_output_tokens: MAX_OUTPUT,
      store: false
    });

    reply = extractTextFromResponse(resp) || MSG_LOST;
    assistantImages = await extractAssistantImages(resp);

    if (!reply) {
      console.log("⚠️ Empty OpenAI response:", JSON.stringify(resp, null, 2));
      reply = MSG_LOST;
    }
  } catch (err) {
    safeLogOpenAIError(err);
    throw new ValkiModelError("Temporary error analyzing image.");
  }

  await saveMessage(conversationId, "assistant", reply, assistantImages, { requestId });

  try {
    const freshMemory = await getConversation(conversationId);
    await maybeUpdateSummary(conversationId, freshMemory);
  } catch {
    // best-effort summary, ignore errors
  }

  return { reply, assistantImages };
}
