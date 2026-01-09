import { config } from "./config.js";
import { decodeDataUrlToBuffer, isDataImageUrl, uploadBufferAndGetPublicUrl } from "./imageProcessing.js";
import { cleanText } from "./utils.js";

export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
export const MAX_IMAGES = 4;
const MAX_URL_LENGTH = 2048;

function normalizeMime(mime) {
  const m = cleanText(mime || "").toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

function uploadBaseUrl() {
  const base = cleanText(config.PUBLIC_UPLOAD_BASE_URL || config.UPLOAD_BASE_URL);
  return base.replace(/\/+$/, "");
}

export function hostFromUrl(url) {
  const safeUrl = cleanText(url);
  if (!safeUrl) return "";
  try {
    const parsed = new URL(safeUrl, "http://dummy.local");
    if (parsed.hostname === "dummy.local" && !safeUrl.startsWith("http")) return "";
    return parsed.hostname;
  } catch {
    return "";
  }
}

function isAllowedUrl(url) {
  const cleanUrl = cleanText(url);
  if (!cleanUrl || cleanUrl.length > MAX_URL_LENGTH) return false;
  if (cleanUrl.startsWith("data:")) return false;
  if (cleanUrl.startsWith("https://") || cleanUrl.startsWith("http://")) return true;

  const base = uploadBaseUrl();
  if (base && cleanUrl.startsWith(base)) return true;
  if (cleanUrl.startsWith("/uploads/")) return true;
  if (base && base.startsWith("http://") && cleanUrl.startsWith(base)) return true;
  return false;
}

export function sanitizeImages(input = []) {
  const warnings = [];

  if (!Array.isArray(input) || !input.length) return { images: [], warnings };

  const images = [];
  const seen = new Set();
  const maxList = input.slice(0, MAX_IMAGES);

  if (input.length > MAX_IMAGES) {
    warnings.push("Too many images provided. Only the first 4 were kept.");
  }

  for (const item of maxList) {
    const hasLegacyData = item?.dataUrl || item?.data;
    if (hasLegacyData) {
      warnings.push("Removed legacy base64 image payload; only image URLs are supported.");
    }

    const url = cleanText(item?.url);
    if (!isAllowedUrl(url)) continue;
    if (seen.has(url)) continue;

    const image = { url };
    const name = cleanText(item?.name).slice(0, 180);
    if (name) image.name = name;

    const mime = normalizeMime(item?.type);
    if (mime && ALLOWED_IMAGE_TYPES.has(mime)) image.type = mime;

    const size = Number(item?.size);
    if (Number.isFinite(size) && size > 0) image.size = size;

    const host = hostFromUrl(url);
    if (host) image.host = host;

    images.push(image);
    seen.add(url);
  }

  return { images, warnings };
}

export async function normalizeImportImages(input = []) {
  const warnings = [];

  if (!Array.isArray(input) || !input.length) return { images: [], warnings };

  const maxList = input.slice(0, MAX_IMAGES);
  if (input.length > MAX_IMAGES) {
    warnings.push("Too many images provided. Only the first 4 were kept.");
  }

  const normalized = [];

  for (const item of maxList) {
    const candidate = cleanText(item?.url || item?.dataUrl || item?.data);
    if (!candidate) continue;

    const name = cleanText(item?.name).slice(0, 180);
    const type = normalizeMime(item?.type);
    const size = Number(item?.size);

    if (isDataImageUrl(candidate)) {
      try {
        const { buffer, mime } = decodeDataUrlToBuffer(candidate);
        const uploaded = await uploadBufferAndGetPublicUrl(buffer, mime, name || "upload");
        if (!uploaded?.url) continue;
        normalized.push({
          url: uploaded.url,
          name: cleanText(uploaded.name) || name || undefined,
          type: cleanText(uploaded.type) || mime || undefined,
          size: Number(uploaded.size) || buffer.length
        });
      } catch (err) {
        warnings.push("Failed to import one image from guest history.");
      }
      continue;
    }

    const entry = { url: candidate };
    if (name) entry.name = name;
    if (type && ALLOWED_IMAGE_TYPES.has(type)) entry.type = type;
    if (Number.isFinite(size) && size > 0) entry.size = size;
    normalized.push(entry);
  }

  const { images, warnings: sanitizeWarnings } = sanitizeImages(normalized);
  return { images, warnings: warnings.concat(sanitizeWarnings) };
}

export function summarizeImageDiagnostics(images = []) {
  const hosts = new Set();
  let minUrlLength = null;
  let maxUrlLength = null;

  for (const img of Array.isArray(images) ? images : []) {
    const url = cleanText(img?.url);
    if (!url) continue;

    const len = url.length;
    if (minUrlLength === null || len < minUrlLength) minUrlLength = len;
    if (maxUrlLength === null || len > maxUrlLength) maxUrlLength = len;

    const host = hostFromUrl(url);
    if (host) hosts.add(host);
  }

  return {
    hosts: Array.from(hosts),
    minUrlLength: minUrlLength ?? 0,
    maxUrlLength: maxUrlLength ?? 0
  };
}
