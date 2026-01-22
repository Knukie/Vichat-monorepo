import crypto from "crypto";
import { WebSocketServer } from "ws";
import { verifyAuthToken } from "../core/auth.js";
import { cleanText } from "../core/utils.js";

const DEFAULT_PATH = "/ws";
const MAX_MESSAGE_BYTES = 64 * 1024;

function toStringMessage(data) {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return "";
}

function sendJson(ws, payload) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function buildError(code, message) {
  return { v: 1, type: "error", code, message };
}

function verifyTokenDefault(token) {
  const cleaned = cleanText(token);
  if (!cleaned) return false;
  const payload = verifyAuthToken(cleaned);
  return Boolean(payload?.uid);
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

    console.log(`[ws] connected ${sessionId} (${req?.socket?.remoteAddress || "unknown"})`);
    sendJson(ws, { v: 1, type: "ready", sessionId, authenticated });

    ws.on("message", (data) => {
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
          sendJson(ws, { v: 1, type: "ready", sessionId, authenticated });
          return;
        }

        if (!verifyTokenFn(token)) {
          authenticated = false;
          sendJson(ws, buildError("UNAUTHORIZED", "Token is invalid."));
          return;
        }

        authenticated = true;
        sendJson(ws, { v: 1, type: "ready", sessionId, authenticated });
        return;
      }

      if (type === "message") {
        sendJson(ws, buildError("NOT_IMPLEMENTED", "Message streaming is not available yet."));
        return;
      }

      sendJson(ws, buildError("UNKNOWN_TYPE", "Unsupported message type."));
    });

    ws.on("close", () => {
      console.log(`[ws] disconnected ${sessionId}`);
    });
  });

  return wss;
}
