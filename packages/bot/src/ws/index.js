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

function verifyTokenDefault(token) {
  const cleaned = cleanText(token);
  if (!cleaned) return false;
  return verifyAuthToken(cleaned);
}

export function attachWebSocketServer(server, { path = DEFAULT_PATH, verifyToken } = {}) {
  const resolvedPath = cleanText(path) || DEFAULT_PATH;
  const verifyTokenFn = typeof verifyToken === "function" ? verifyToken : verifyTokenDefault;

  const wss = new WebSocketServer({
    server,
    path: resolvedPath,
    maxPayload: MAX_MESSAGE_BYTES
  });

  wss.on("connection", (ws, req) => {
    const sessionId = crypto.randomUUID();
    let authenticated = false;
    let userId = null;

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
        const clientId = cleanText(message?.clientId);
        const incomingText = cleanText(message?.message || message?.text);
        const preferredLocale = cleanText(message?.locale) || pickPrimaryLocale(req?.headers?.["accept-language"]);
        const providedCid = cleanText(message?.conversationId);
        const incomingImages = Array.isArray(message?.images) ? message.images : [];

        if (!messageId) {
          sendJson(ws, buildError("INVALID_MESSAGE_ID", "messageId is required."));
          return;
        }

        if (!clientId) {
          sendJson(ws, buildError("INVALID_CLIENT_ID", "clientId is required.", { messageId }));
          return;
        }

        if (!incomingText && !incomingImages.length) {
          sendJson(
            ws,
            buildError("INVALID_MESSAGE", "Message text or images are required.", { messageId })
          );
          return;
        }

        try {
          pruneMessageCache();
          const cached = messageCache.get(messageId);
          if (cached && Date.now() - cached.ts <= MESSAGE_DEDUPE_TTL_MS) {
            sendJson(ws, {
              v: 1,
              type: "message",
              messageId,
              conversationId: cached.conversationId,
              reply: cached.reply
            });
            return;
          }

          await ensureTablesExistOrThrow();

          let cid = "";
          if (authenticated && Number.isFinite(userId)) {
            cid = await getOrCreateConversationForUser(userId);
          } else {
            cid = providedCid || newConversationId();
          }

          const { images: sanitizedImages } = sanitizeImages(incomingImages);
          const userTextForRun = incomingText || "[image]";

          const { reply } = await runValki({
            userText: userTextForRun,
            conversationId: cid,
            preferredLocale,
            images: sanitizedImages,
            requestId: messageId
          });

          messageCache.set(messageId, { ts: Date.now(), conversationId: cid, reply });

          sendJson(ws, { v: 1, type: "message", messageId, conversationId: cid, reply });
          return;
        } catch (err) {
          if (err instanceof ValkiModelError) {
            sendJson(
              ws,
              buildError("MODEL_ERROR", "Temporary error analyzing image.", { messageId })
            );
            return;
          }
          console.error("[ws] message error:", err);
          sendJson(ws, buildError("INTERNAL_ERROR", "Internal backend error.", { messageId }));
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
