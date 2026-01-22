import { WebSocket } from "ws";

const port = process.env.PORT || 3000;
const path = process.env.WS_PATH || "/ws";
const url = process.env.WS_URL || `ws://localhost:${port}${path}`;

const ws = new WebSocket(url);

const timeout = setTimeout(() => {
  console.error("Timed out waiting for pong/message.");
  ws.close();
  process.exit(1);
}, 8000);

ws.on("open", () => {
  console.log(`Connected to ${url}`);
  ws.send(JSON.stringify({ v: 1, type: "ping", ts: Date.now() }));
});

ws.on("message", (data) => {
  const raw = data.toString();
  console.log("Received:", raw);
  try {
    const message = JSON.parse(raw);
    if (message?.type === "pong") {
      ws.send(
        JSON.stringify({
          v: 1,
          type: "message",
          messageId: `smoke-${Date.now()}`,
          clientId: "ws-smoke",
          message: "Hello from ws smoke test"
        })
      );
      return;
    }
    if (message?.type === "message") {
      clearTimeout(timeout);
      ws.close();
    }
  } catch {
    // ignore parse errors
  }
});

ws.on("close", () => {
  clearTimeout(timeout);
  console.log("Disconnected.");
});
