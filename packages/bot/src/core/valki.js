import { MAX_INPUT, MAX_OUTPUT, OPENAI_CHAT_MODEL, OPENAI_SUMMARY_MODEL } from "./config.js";
import { ensureTablesExistOrThrow, getConversation, saveMessage, setConversationSummary } from "./db.js";
import { sanitizeImages } from "./images.js";
import { isValidHttpUrl } from "./imageProcessing.js";
import { openai } from "./openai.js";
import { MSG_LOST, cleanText, extractTextFromResponse, safeLogOpenAIError } from "./utils.js";
import { getAgentPersona } from "./agents/index.js";

export class ValkiModelError extends Error {}

// -----------------------
// ENV
// -----------------------
const CHAT_MODEL = OPENAI_CHAT_MODEL;
const SUMMARY_MODEL = OPENAI_SUMMARY_MODEL;
const SUMMARY_MIN_MESSAGES = Number(process.env.VALKI_SUMMARY_MIN_MESSAGES || 12);
const ENABLE_WEB_SEARCH = cleanText(process.env.VALKI_ENABLE_WEB_SEARCH) === "1";

// -----------------------
// Helpers
// -----------------------
function defaultImagePrompt(locale = "") {
  const l = cleanText(locale).toLowerCase();
  if (l.startsWith("nl")) return "Beschrijf rustig wat er op de afbeelding(en) staat.";
  return "Describe calmly what is in the image(s).";
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

function buildContextBlock(memory) {
  const summary = cleanText(memory?.summary) || "(none)";
  const msgs = Array.isArray(memory?.messages) ? memory.messages : [];
  const recent = msgs.length
    ? msgs
        .slice(-12)
        .map((m) => `${m.role}: ${m.content}${formatImagesNote(m.images)}`)
        .join("\n")
    : "(none)";

  return `Conversation summary:\n${summary}\n\nRecent messages:\n${recent}`;
}

function buildUserParts({ hasText, rawText, preferredLocale, sanitizedImages }) {
  /** @type {import("openai/resources/responses/responses").ResponseInputMessageContentList} */
  const userParts = [];

  const effectiveText = hasText ? rawText : defaultImagePrompt(preferredLocale);
  userParts.push({ type: "input_text", text: effectiveText });

  for (const img of sanitizedImages) {
    const url = cleanText(img?.url);
    if (!url) continue;
    if (!isValidHttpUrl(url)) continue;
    userParts.push({ type: "input_image", image_url: url, detail: "auto" });
  }

  return { userParts, effectiveText };
}

async function maybeUpdateSummary(conversationId, memory) {
  const msgs = Array.isArray(memory?.messages) ? memory.messages : [];
  if (msgs.length < SUMMARY_MIN_MESSAGES) return;

  const transcript = msgs
    .slice(-30)
    .map((m) => `${m.role === "assistant" ? "VALKI" : "User"}: ${m.content}`)
    .join("\n");

  const resp = await openai.responses.create({
    model: SUMMARY_MODEL,
    input:
      "Summarize this conversation as durable memory in 3-6 bullets. " +
      "Keep stable facts, preferences, and ongoing goals only. No fluff.\n\n" +
      transcript,
    max_output_tokens: 140,
    store: false
  });

  const summary = cleanText(extractTextFromResponse(resp));
  if (summary) await setConversationSummary(conversationId, summary);
}

// Hard clamp so we never violate “max 2 sentences”
function clampToTwoSentences(text) {
  const t = cleanText(text);
  if (!t) return "";
  const parts = t
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  // If model returns a long run-on without punctuation, just cut length.
  if (parts.length === 1) return parts[0].slice(0, 240).trim();

  return parts.slice(0, 2).join(" ").trim();
}

// -----------------------
// Main
// -----------------------
export async function runValki({
  userText,
  conversationId,
  preferredLocale = "",
  images = [],
  requestId,
  agent = "valki"
}) {
  const rawText = cleanText(userText);
  const persona = getAgentPersona(agent);
  const isPlaceholderImage = rawText === "[image]";

  const { images: sanitizedImages } = sanitizeImages(images);
  const hasImages = sanitizedImages.length > 0;
  const hasText = !!rawText && !isPlaceholderImage;

  if (!hasText && !hasImages) {
    return { reply: MSG_LOST, assistantImages: [] };
  }

  if (hasText && rawText.length > MAX_INPUT) {
    // Keep VALKI tone: minimal, no emoji
    return { reply: `Too long. Under ${MAX_INPUT} characters.`, assistantImages: [] };
  }

  await ensureTablesExistOrThrow();

  const memory = await getConversation(conversationId);
  const contextBlock = buildContextBlock(memory);

  const { userParts, effectiveText } = buildUserParts({
    hasText,
    rawText,
    preferredLocale,
    sanitizedImages
  });

  await saveMessage(conversationId, "customer", effectiveText, sanitizedImages, { requestId });

  let reply = "";
  try {
    /** @type {import("openai/resources/responses/responses").ResponseInput} */
    const input = [
      {
        role: "developer",
        type: "message",
        content: [
          {
            type: "input_text",
            text:
              `${persona}\n\n` +
              "Hard constraints:\n" +
              "- Reply in Dutch unless the user clearly writes in another language.\n" +
              "- Maximum 2 sentences.\n" +
              "- No emojis.\n" +
              "- No explanations.\n\n" +
              "Conversation context (do not quote it):\n" +
              contextBlock
          }
        ]
      },
      { role: "user", type: "message", content: userParts }
    ];

    const req = {
      model: CHAT_MODEL,
      input,
      max_output_tokens: MAX_OUTPUT,
      store: false
    };

    if (ENABLE_WEB_SEARCH) {
      req.tools = [{ type: "web_search_preview" }];
      req.tool_choice = "auto";
    }

    const resp = await openai.responses.create(req);

    reply = clampToTwoSentences(extractTextFromResponse(resp)) || MSG_LOST;
    if (!reply) reply = MSG_LOST;
  } catch (err) {
    safeLogOpenAIError(err);
    throw new ValkiModelError("Temporary error generating reply.");
  }

  await saveMessage(conversationId, "assistant", reply, [], { requestId });

  try {
    const freshMemory = await getConversation(conversationId);
    await maybeUpdateSummary(conversationId, freshMemory);
  } catch {
    // ignore
  }

  return { reply, assistantImages: [] };
}
