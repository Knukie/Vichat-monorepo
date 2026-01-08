import { ALLOWED_IMAGE_TYPES } from "./images.js";
import { MAX_IMAGE_BYTES, storeUploadedFile } from "./uploads.js";
import { cleanText } from "./utils.js";

export function isValidHttpUrl(input) {
  const value = cleanText(input);
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isDataImageUrl(input) {
  const value = cleanText(input);
  if (!value) return false;
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

export function decodeDataUrlToBuffer(dataUrl) {
  if (!isDataImageUrl(dataUrl)) throw new Error("invalid_data_url");

  const safe = cleanText(dataUrl);
  const match = safe.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) throw new Error("invalid_data_url");

  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mime)) throw new Error("unsupported_image_type");

  let buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    throw new Error("invalid_data_url");
  }

  if (!buffer?.length) throw new Error("invalid_data_url");
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("image_too_large");

  return { buffer, mime };
}

export async function uploadBufferAndGetPublicUrl(buffer, mime, name = "upload") {
  const meta = await storeUploadedFile({ buffer, mime, name, size: buffer.length });
  const url = cleanText(meta?.url);

  return {
    url,
    name: cleanText(meta?.name) || name,
    type: cleanText(meta?.type) || mime,
    size: Number(meta?.size) || buffer.length
  };
}
