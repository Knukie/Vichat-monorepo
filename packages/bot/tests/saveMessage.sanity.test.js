import assert from "assert";

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/valki_test";
process.env.VALKI_PROMPT_ID = process.env.VALKI_PROMPT_ID || "prompt-id";
process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || "secret";

const { pool, saveMessage } = await import("../src/core/db.js");

function makeMockQuery() {
  const calls = [];
  const query = async (text, params) => {
    calls.push({ text, params });
    return { rows: [] };
  };
  return { calls, query };
}

async function runSaveMessage(images) {
  const { calls, query } = makeMockQuery();
  const originalQuery = pool.query;
  pool.query = query;

  try {
    await saveMessage("conv-test", "user", "hello", images, { requestId: "r1" });
  } finally {
    pool.query = originalQuery;
  }

  assert.strictEqual(calls.length, 1, "saveMessage should execute exactly one query");
  const call = calls[0];
  assert.ok(call.text.includes("$4::jsonb"), "images should be cast to jsonb");
  assert.strictEqual(typeof call.params[3], "string", "json payload should be stringified");
  const parsed = JSON.parse(call.params[3]);
  assert.ok(Array.isArray(parsed), "stored images should always be an array");
  return parsed;
}

await runSaveMessage([]);
const storedWithUrl = await runSaveMessage([{ url: "https://example.com/a.jpg", name: "a.jpg" }]);
assert.deepStrictEqual(storedWithUrl, [
  { url: "https://example.com/a.jpg", name: "a.jpg", host: "example.com" }
]);

const storedWithDataUrl = await runSaveMessage([
  { dataUrl: "data:image/jpeg;base64,AAA", name: "inline.jpg" }
]);
assert.deepStrictEqual(storedWithDataUrl, []);

const storedWithInvalid = await runSaveMessage("nope");
assert.deepStrictEqual(storedWithInvalid, []);

console.log("saveMessage JSON handling tests passed");
