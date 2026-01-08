import crypto from "crypto";
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { ALLOWED_IMAGE_TYPES } from "./images.js";
import { cleanText } from "./utils.js";

const uploadRoot = config.UPLOAD_DIR || "/tmp/valki-uploads";
fs.mkdirSync(uploadRoot, { recursive: true });

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const canUseS3 =
  !!config.S3_BUCKET &&
  !!config.S3_ACCESS_KEY_ID &&
  !!config.S3_SECRET_ACCESS_KEY &&
  !!config.S3_ENDPOINT;

function extForMime(mime) {
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  return "";
}

function normalizeMime(mime) {
  const m = cleanText(mime || "").toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

function publicUrlForKey(key) {
  const normalizedKey = cleanText(key).replace(/^\/+/, "");
  const localKey = normalizedKey.replace(/^uploads\//, "");
  const base = cleanText(config.PUBLIC_UPLOAD_BASE_URL || config.UPLOAD_BASE_URL).replace(/\/+$/, "");
  if (base) return `${base}/${normalizedKey}`;
  if (canUseS3) {
    const endpoint = cleanText(config.S3_ENDPOINT).replace(/\/+$/, "");
    if (endpoint) return `${endpoint}/${config.S3_BUCKET}/${normalizedKey}`;
  }
  return `/uploads/${localKey}`;
}

function randomKey(ext) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const rand = crypto.randomBytes(12).toString("hex");
  return `uploads/${yyyy}/${mm}/${rand}${ext}`;
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function getSignatureKey(secret, date, region, service) {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function amzDate() {
  return new Date().toISOString().replace(/[:-]/g, "").replace(/\.\d{3}/, "");
}

function canonicalQuery(params) {
  const pairs = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value ?? "")}`);
  }
  return pairs.sort().join("&");
}

async function uploadToS3({ buffer, mime, key }) {
  if (!canUseS3) return "";

  const url = new URL(config.S3_ENDPOINT);
  const basePath = url.pathname.replace(/\/$/, "");
  url.pathname = `${basePath}/${config.S3_BUCKET}/${key}`;

  const amz = amzDate();
  const dateStamp = amz.slice(0, 8);
  const payloadHash = sha256Hex(buffer);
  const canonicalHeaders =
    `content-type:${mime}\n` +
    `host:${url.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amz}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    url.pathname,
    canonicalQuery(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const region = config.S3_REGION || "auto";
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = getSignatureKey(config.S3_SECRET_ACCESS_KEY, dateStamp, region, "s3");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.S3_ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": mime,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amz
    },
    body: buffer
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`S3 upload failed: ${res.status} ${body.slice(0, 100)}`);
  }

  return publicUrlForKey(key);
}

async function storeLocally({ buffer, key }) {
  const relativeKey = key.replace(/^\/+/, "").replace(/^uploads\//, "");
  const targetPath = path.join(uploadRoot, relativeKey);
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, buffer);
  return publicUrlForKey(key);
}

export async function storeUploadedFile({ buffer, mime, name, size }) {
  const normalizedMime = normalizeMime(mime);
  if (!ALLOWED_IMAGE_TYPES.has(normalizedMime)) throw new Error("Only JPEG/PNG supported.");
  if (!buffer?.length) throw new Error("Empty file.");
  if (Number(size) > MAX_IMAGE_BYTES) throw new Error("Image too large. Max 5 MB.");

  const ext = extForMime(normalizedMime) || ".img";
  const key = randomKey(ext);
  const safeName = cleanText(name).slice(0, 180) || `upload${ext}`;

  let url = "";
  if (canUseS3) {
    try {
      url = await uploadToS3({ buffer, mime: normalizedMime, key });
    } catch (err) {
      console.error("S3 upload failed:", err?.message || err);
      url = "";
    }
  }

  if (!url) {
    url = await storeLocally({ buffer, key });
  }

  return { url, name: safeName, type: normalizedMime, size: buffer.length };
}

export { uploadRoot as uploadDir };
