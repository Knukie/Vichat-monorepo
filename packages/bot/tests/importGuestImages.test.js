import assert from "node:assert/strict";
import test from "node:test";
import { prepareGuestImportMessages } from "../src/core/importGuest.js";

const DATA_URL_PNG =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7n7X0AAAAASUVORK5CYII=";

test("prepareGuestImportMessages keeps text-only guest messages", async () => {
  const items = [{ role: "user", content: "Hello there" }];
  const cleaned = await prepareGuestImportMessages(items);

  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].role, "customer");
  assert.equal(cleaned[0].content, "Hello there");
  assert.deepEqual(cleaned[0].images, []);
});

test("prepareGuestImportMessages converts data URLs into stored image URLs", async () => {
  const items = [
    {
      role: "user",
      content: "Image attached",
      images: [{ dataUrl: DATA_URL_PNG, type: "image/png", name: "pixel.png", size: 68 }]
    }
  ];
  const cleaned = await prepareGuestImportMessages(items);

  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].images.length, 1);
  assert.ok(cleaned[0].images[0].url);
  assert.ok(!cleaned[0].images[0].url.startsWith("data:"));
});

test("prepareGuestImportMessages keeps valid HTTP image URLs", async () => {
  const items = [
    {
      role: "assistant",
      content: "Here you go",
      images: [{ url: "https://example.com/test.png", type: "image/png", name: "test.png" }]
    }
  ];
  const cleaned = await prepareGuestImportMessages(items);

  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].images.length, 1);
  assert.equal(cleaned[0].images[0].url, "https://example.com/test.png");
});

test("prepareGuestImportMessages skips invalid images but keeps text", async () => {
  const items = [
    {
      role: "user",
      content: "Broken image",
      images: [{ dataUrl: "data:image/png;base64," }]
    }
  ];
  const cleaned = await prepareGuestImportMessages(items);

  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].content, "Broken image");
  assert.equal(cleaned[0].images.length, 0);
});
