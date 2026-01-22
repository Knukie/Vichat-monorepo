import crypto from "crypto";
import { WebSocketServer } from "ws";
import { verifyAuthToken } from "../core/auth.js";
import { ensureTablesExistOrThrow, getOrCreateConversationForUser } from "../core/db.js";
import { sanitizeImages } from "../core/images.js";
import { runValki, ValkiModelError } from "../core/valki.js";
import { cleanText, newConversationId, pickPrimaryLocale } from "../core/utils.js";

const DEFAULT_PATH = "/ws";
const MAX_MESSAGE_BYTES = 64 * 1024;
const MESSAGE_DEDUPE_TTL_MS = 2 * 60 * 1000;
const messageCache = new Map();

function nowTs() {
  return Date.now();
}

function pruneMessageCache(now = Date.now()) {
  for (const [key, entry] of messageCache.entries()) {
    if (!entry || now - entry.ts > MESSAGE_DEDUPE_TTL_MS) {
      messageCache.delete(key);
    }
  }
}

function toStringMessage(data) {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return "";
}

function sendJson(ws, payload) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function buildError(code, message, meta = {}) {
  return { v: 1, type: "error", code, message, ...meta };
}

function buildAssistantStart({ messageId, conversationId, requestId }) {
  return {
    v: 1,
    type: "assistant.message.start",
    messageId,
    conversationId: conversationId || null,
    requestId,
    ts: nowTs()
  };
}

function buildAssistantDelta({ messageId, requestId, seq, delta }) {
  return {
    v: 1,
    type: "assistant.message.delta",
    messageId,
    requestId,
    seq,
    delta,
    ts: nowTs()
  };
}

function buildAssistantEnd({ messageId, requestId, seq, finishReason, usage }) {
  return {
    v: 1,
    type: "assistant.message.end",
    messageId,
    requestId,
    seq,
    finishReason,
    usage,
    ts: nowTs()
  };
}

function buildAssistantError({ requestId, messageId, code, message }) {
  return {
    v: 1,
    type: "assistant.message.error",
    requestId,
    messageId: messageId || null,
    code,
    message,
    ts: nowTs()
  };
}

function splitIntoChunks(text, minSize = 20, maxSize = 80) {
  if (!text) return [];
  const size = Math.min(maxSize, Math.max(minSize, 60));
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function verifyTokenDefault(token) {
  const cleaned = cleanText(token);
  if (!cleaned) return false;
  return verifyAuthToken(cleaned);
}

export function attachWebSocketServer(
  server,
  { path = DEFAULT_PATH, verifyToken, runAssistant } = {}
) {
  const resolvedPath = cleanText(path) || DEFAULT_PATH;
  const verifyTokenFn = typeof verifyToken === "function" ? verifyToken : verifyTokenDefault;
  const runAssistantFn = typeof runAssistant === "function" ? runAssistant : runValki;

  const wss = new WebSocketServer({
    server,
    path: resolvedPath,
    maxPayload: MAX_MESSAGE_BYTES
  });

  wss.on("connection", (ws, req) => {
    const sessionId = crypto.randomUUID();
    let authenticated = false;
    let userId = null;
    const requestStatus = new Map();

    console.log(`[ws] connected ${sessionId} (${req?.socket?.remoteAddress || "unknown"})`);
    sendJson(ws, { v: 1, type: "ready", sessionId, authenticated });

    ws.on("message", async (data) => {
      const raw = toStringMessage(data);
      if (!raw) {
        sendJson(ws, buildError("INVALID_JSON", "Message payload must be text JSON."));
        return;
      }
      if (raw.length > MAX_MESSAGE_BYTES) {
        sendJson(ws, buildError("PAYLOAD_TOO_LARGE", "Message exceeds 64KB limit."));
        return;
      }

      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        sendJson(ws, buildError("INVALID_JSON", "Unable to parse JSON payload."));
        return;
      }

      if (message?.v !== 1) {
        sendJson(ws, buildError("UNSUPPORTED_VERSION", "Unsupported protocol version."));
        return;
      }

      const type = cleanText(message?.type);
      if (type === "ping") {
        const ts = Number.isFinite(message?.ts) ? message.ts : Date.now();
        sendJson(ws, { v: 1, type: "pong", ts });
        return;
      }

      if (type === "auth") {
        const token = cleanText(message?.token);
        if (!token) {
          authenticated = false;
          userId = null;
          sendJson(ws, { v: 1, type: "ready", sessionId, authenticated });
          return;
        }

        const payload = verifyTokenFn(token);
        if (!payload?.uid) {
          authenticated = false;
          userId = null;
          const errorPayload = buildAssistantError({
            requestId: crypto.randomUUID(),
            messageId: null,
            code: "UNAUTHORIZED",
            message: "Token is invalid."
          });
          sendJson(ws, errorPayload);
          sendJson(ws, buildError("UNAUTHORIZED", "Token is invalid."));
          return;
        }

        authenticated = true;
        userId = Number(payload.uid);
        sendJson(ws, { v: 1, type: "ready", sessionId, authenticated });
        return;
      }

      if (type === "message") {
        const messageId = cleanText(message?.messageId);
        const requestId = cleanText(message?.requestId) || messageId || crypto.randomUUID();
        const clientId = cleanText(message?.clientId);
        const incomingText = cleanText(message?.message || message?.text);
        const preferredLocale = cleanText(message?.locale) || pickPrimaryLocale(req?.headers?.["accept-language"]);
        const providedCid = cleanText(message?.conversationId);
        const incomingImages = Array.isArray(message?.images) ? message.images : [];

        if (!messageId) {
          sendJson(
            ws,
            buildAssistantError({
              requestId,
              messageId: null,
              code: "BAD_REQUEST",
              message: "messageId is required."
            })
          );
          sendJson(ws, buildError("INVALID_MESSAGE_ID", "messageId is required."));
          return;
        }

        if (!clientId) {
          sendJson(
            ws,
            buildAssistantError({
              requestId,
              messageId,
              code: "BAD_REQUEST",
              message: "clientId is required."
            })
          );
          sendJson(ws, buildError("INVALID_CLIENT_ID", "clientId is required.", { messageId }));
          return;
        }

        if (!incomingText && !incomingImages.length) {
          sendJson(
            ws,
            buildAssistantError({
              requestId,
              messageId,
              code: "BAD_REQUEST",
              message: "Message text or images are required."
            })
          );
          sendJson(
            ws,
            buildError("INVALID_MESSAGE", "Message text or images are required.", { messageId })
          );
          return;
        }

        const priorStatus = requestStatus.get(requestId);
        if (priorStatus?.status === "in_progress" || priorStatus?.status === "done") {
          sendJson(
            ws,
            buildAssistantError({
              requestId,
              messageId: null,
              code: "BAD_REQUEST",
              message: "Duplicate requestId"
            })
          );
          sendJson(ws, buildError("DUPLICATE_REQUEST", "Duplicate requestId", { messageId }));
          return;
        }

        requestStatus.set(requestId, { status: "in_progress", ts: nowTs() });
        const assistantMessageId = crypto.randomUUID();
        let seq = 0;
        let started = false;

        const sendStart = (conversationId) => {
          started = true;
          sendJson(
            ws,
            buildAssistantStart({
              messageId: assistantMessageId,
              conversationId,
              requestId
            })
          );
        };

        const sendDelta = (delta) => {
          seq += 1;
          sendJson(
            ws,
            buildAssistantDelta({ messageId: assistantMessageId, requestId, seq, delta })
          );
        };

        const sendEnd = (finishReason) => {
          sendJson(
            ws,
            buildAssistantEnd({
              messageId: assistantMessageId,
              requestId,
              seq,
              finishReason,
              usage: { inputTokens: 0, outputTokens: 0 }
            })
          );
        };

        try {
          pruneMessageCache();
          const cached = messageCache.get(messageId);
          if (cached && Date.now() - cached.ts <= MESSAGE_DEDUPE_TTL_MS) {
            sendStart(cached.conversationId);
            const chunks = splitIntoChunks(cached.reply);
            for (const chunk of chunks) {
              sendDelta(chunk);
            }
            sendEnd("stop");
            sendJson(ws, {
              v: 1,
              type: "message",
              messageId,
              conversationId: cached.conversationId,
              reply: cached.reply,
              streamed: true
            });
            requestStatus.set(requestId, { status: "done", ts: nowTs() });
            return;
          }

          await ensureTablesExistOrThrow();

          let cid = "";
          if (authenticated && Number.isFinite(userId)) {
            cid = await getOrCreateConversationForUser(userId);
          } else {
            cid = providedCid || newConversationId();
          }

          sendStart(cid);

          const { images: sanitizedImages } = sanitizeImages(incomingImages);
          const userTextForRun = incomingText || "[image]";

          const { reply } = await runAssistantFn({
            userText: userTextForRun,
            conversationId: cid,
            preferredLocale,
            images: sanitizedImages,
            requestId
          });

          messageCache.set(messageId, { ts: Date.now(), conversationId: cid, reply });

          const chunks = splitIntoChunks(reply);
          for (const chunk of chunks) {
            sendDelta(chunk);
          }
          sendEnd("stop");
          sendJson(ws, {
            v: 1,
            type: "message",
            messageId,
            conversationId: cid,
            reply,
            streamed: true
          });
          requestStatus.set(requestId, { status: "done", ts: nowTs() });
          return;
        } catch (err) {
          if (err instanceof ValkiModelError) {
            sendJson(
              ws,
              buildAssistantError({
                requestId,
                messageId: assistantMessageId,
                code: "INTERNAL",
                message: "Temporary error analyzing image."
              })
            );
            if (started) {
              sendEnd("error");
            }
            sendJson(
              ws,
              buildError("MODEL_ERROR", "Temporary error analyzing image.", { messageId })
            );
            requestStatus.set(requestId, { status: "done", ts: nowTs() });
            return;
          }
          console.error("[ws] message error:", err);
          sendJson(
            ws,
            buildAssistantError({
              requestId,
              messageId: assistantMessageId,
              code: "INTERNAL",
              message: "Internal backend error."
            })
          );
          if (started) {
            sendEnd("error");
          }
          sendJson(ws, buildError("INTERNAL_ERROR", "Internal backend error.", { messageId }));
          requestStatus.set(requestId, { status: "done", ts: nowTs() });
          return;
        }
      }

      sendJson(ws, buildError("UNKNOWN_TYPE", "Unsupported message type."));
    });

    ws.on("close", () => {
      console.log(`[ws] disconnected ${sessionId}`);
    });
  });

  return wss;
}
