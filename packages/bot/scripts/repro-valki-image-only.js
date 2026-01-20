import process from "process";

const baseUrl = process.env.VALKI_BASE_URL || process.argv[2] || "http://localhost:3000";
const apiUrl = new URL("/api/valki", baseUrl).toString();

const imageUrl =
  process.env.VALKI_TEST_IMAGE_URL ||
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/June_odd-eyed-cat.jpg/320px-June_odd-eyed-cat.jpg";

async function post(payload) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function run() {
  console.log("POST", apiUrl);
  const withText = await post({
    message: "Hello!",
    clientId: "repro-client",
    images: [{ url: imageUrl, type: "external", name: "cat.jpg" }]
  });
  console.log("message+image", withText.status, withText.body);

  const imageOnly = await post({
    message: "",
    clientId: "repro-client",
    images: [{ url: imageUrl, type: "external", name: "cat.jpg" }]
  });
  console.log("image-only", imageOnly.status, imageOnly.body);
}

run().catch((err) => {
  console.error("repro failed", err?.message || err);
  process.exitCode = 1;
});
