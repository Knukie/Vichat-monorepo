import assert from "assert";
import http from "http";
import { WebSocket } from "ws";
import { attachWebSocketServer } from "../src/ws/index.js";

process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || "secret";

async function startServer({ runAssistant, verifyToken } = {}) {
  const server = http.createServer();
  attachWebSocketServer(server, { path: "/ws", runAssistant, verifyToken });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `ws://127.0.0.1:${port}/ws` };
}

function waitForEvent(events, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const found = events.find(predicate);
      if (found) {
        clearInterval(timer);
        resolve(found);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for event"));
      }
    }, 10);
  });
}

async function collectMessages(ws) {
  const events = [];
  ws.on("message", (data) => {
    const raw = typeof data === "string" ? data : data.toString("utf8");
    try {
      events.push(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  });
  await new Promise((resolve) => ws.once("open", resolve));
  return events;
}

async function testStreamingSequence() {
  const replyText = "x".repeat(180);
  const { server, url } = await startServer({
    runAssistant: async () => ({ reply: replyText })
  });
  const ws = new WebSocket(url);
  const events = await collectMessages(ws);

  await waitForEvent(events, (event) => event.type === "ready");

  ws.send(
    JSON.stringify({
      v: 1,
      type: "message",
      messageId: "client-msg-1",
      requestId: "req-1",
      clientId: "client-1",
      message: "hello"
    })
  );

  const endEvent = await waitForEvent(
    events,
    (event) => event.type === "assistant.message.end" && event.requestId === "req-1"
  );
  const streamEvents = events.filter(
    (event) =>
      event.requestId === "req-1" && event.type?.startsWith("assistant.message.")
  );

  assert.strictEqual(streamEvents[0].type, "assistant.message.start");
  assert.strictEqual(streamEvents[streamEvents.length - 1].type, "assistant.message.end");
  assert.strictEqual(endEvent.finishReason, "stop");

  const messageId = streamEvents[0].messageId;
  const deltaSeqs = streamEvents
    .filter((event) => event.type === "assistant.message.delta")
    .map((event) => event.seq);
  assert.ok(deltaSeqs.length >= 1, "should send at least one delta");
  for (let i = 1; i < deltaSeqs.length; i += 1) {
    assert.ok(deltaSeqs[i] > deltaSeqs[i - 1], "delta seq should increase");
  }
  assert.ok(
    endEvent.seq > deltaSeqs[deltaSeqs.length - 1],
    "end seq should be greater than last delta"
  );
  for (const event of streamEvents) {
    assert.strictEqual(event.messageId, messageId);
  }

  ws.close();
  await new Promise((resolve) => ws.once("close", resolve));
  await new Promise((resolve) => server.close(resolve));
}

async function testUnauthorized() {
  const { server, url } = await startServer({
    verifyToken: () => null
  });
  const ws = new WebSocket(url);
  const events = await collectMessages(ws);
  await waitForEvent(events, (event) => event.type === "ready");

  ws.send(JSON.stringify({ v: 1, type: "auth", token: "bad-token" }));

  const errorEvent = await waitForEvent(
    events,
    (event) => event.type === "assistant.message.error" && event.code === "UNAUTHORIZED"
  );
  assert.ok(errorEvent, "should emit assistant.message.error for unauthorized");
  const streamEvents = events.filter((event) => event.type?.startsWith("assistant.message."));
  assert.strictEqual(streamEvents.length, 1, "no start/delta/end for unauthorized auth");

  ws.close();
  await new Promise((resolve) => ws.once("close", resolve));
  await new Promise((resolve) => server.close(resolve));
}

async function testDuplicateRequestId() {
  let callCount = 0;
  const { server, url } = await startServer({
    runAssistant: async () => {
      callCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { reply: "hello" };
    }
  });
  const ws = new WebSocket(url);
  const events = await collectMessages(ws);
  await waitForEvent(events, (event) => event.type === "ready");

  const payload = {
    v: 1,
    type: "message",
    messageId: "client-msg-2",
    requestId: "dup-1",
    clientId: "client-1",
    message: "hello"
  };

  ws.send(JSON.stringify(payload));
  ws.send(JSON.stringify({ ...payload, messageId: "client-msg-2b" }));

  const dupError = await waitForEvent(
    events,
    (event) =>
      event.type === "assistant.message.error" &&
      event.requestId === "dup-1" &&
      event.code === "BAD_REQUEST"
  );
  assert.ok(dupError, "should emit duplicate requestId error");
  assert.strictEqual(callCount, 1, "runAssistant should be called once");

  await waitForEvent(
    events,
    (event) => event.type === "assistant.message.end" && event.requestId === "dup-1"
  );

  ws.close();
  await new Promise((resolve) => ws.once("close", resolve));
  await new Promise((resolve) => server.close(resolve));
}

await testStreamingSequence();
await testUnauthorized();
await testDuplicateRequestId();

console.log("ws streaming tests passed");
