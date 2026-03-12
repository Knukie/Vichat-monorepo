import { cleanText } from "../core/utils.js";

const IQAI_PRICE_TYPES = Object.freeze({
  all: "all",
  frax: "frax",
  eth: "eth"
});

function normalizeBaseUrl(url) {
  return cleanText(url).replace(/\/+$/, "");
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function isValidIqaiPriceType(type) {
  return Object.hasOwn(IQAI_PRICE_TYPES, String(type || "").toLowerCase());
}

export function normalizeIqaiPriceType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return isValidIqaiPriceType(normalized) ? IQAI_PRICE_TYPES[normalized] : null;
}

export async function fetchIqaiPrices(type) {
  const normalizedType = normalizeIqaiPriceType(type);
  const baseUrl = normalizeBaseUrl(process.env.IQAI_API_BASE) || "https://app.iqai.com";
  const upstreamUrl = new URL(`${baseUrl}/api/prices`);
  upstreamUrl.searchParams.set("type", normalizedType || IQAI_PRICE_TYPES.all);

  const bearer = cleanText(process.env.IQAI_BEARER);
  const headers = { Accept: "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const upstreamResponse = await fetch(upstreamUrl, {
    method: "GET",
    headers
  });

  const bodyText = await upstreamResponse.text();
  const bodyJson = parseJsonSafe(bodyText);

  if (!upstreamResponse.ok) {
    console.error("[iqai] /api/prices upstream failed", {
      url: upstreamUrl.toString(),
      status: upstreamResponse.status,
      body: bodyText.slice(0, 1000)
    });
  }

  return {
    url: upstreamUrl.toString(),
    status: upstreamResponse.status,
    ok: upstreamResponse.ok,
    bodyText,
    bodyJson
  };
}
