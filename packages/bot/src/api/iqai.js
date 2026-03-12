import { Router } from "express";
import { cleanText } from "../core/utils.js";
import { getAgentHistorySnapshot } from "../services/agentPriceSnapshots.js";

const iqaiRouter = Router();
const allowedProxyPaths = new Set([
  "/api/agents",
  "/api/agents/info",
  "/api/agents/stats",
  "/api/agents/top",
  "/api/holdings",
  "/api/logs",
  "/api/metrics",
  "/api/prices",
  "/api/transactions"
]);

function normalizeBaseUrl(url) {
  return cleanText(url).replace(/\/+$/, "");
}

function toDateOrNull(value) {
  if (value == null || value === "") return null;

  const parseEpochByDigits = (epoch, digitCount = String(Math.abs(epoch)).length) => {
    if (!Number.isSafeInteger(epoch)) return null;
    if (digitCount === 13 || digitCount === 12) return new Date(epoch);
    if (digitCount === 10) return new Date(epoch * 1000);
    return null;
  };

  let parsed;
  if (typeof value === "number" && Number.isFinite(value)) {
    parsed = parseEpochByDigits(value);
  } else {
    const text = String(value).trim();
    if (!text) return null;
    if (/^[-+]?\d+$/.test(text)) {
      const signlessDigits = text.replace(/^[-+]/, "");
      if ([10, 12, 13].includes(signlessDigits.length)) {
        parsed = parseEpochByDigits(Number(text), signlessDigits.length);
      } else {
        return null;
      }
    } else {
      parsed = new Date(text);
    }
  }

  if (!parsed) return null;
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRangeStart(range) {
  const now = Date.now();
  const normalized = cleanText(range).toUpperCase();
  if (normalized === "5D") return new Date(now - 5 * 24 * 60 * 60 * 1000);
  if (normalized === "1M") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (normalized === "3M") return new Date(now - 90 * 24 * 60 * 60 * 1000);
  if (normalized === "6M") return new Date(now - 180 * 24 * 60 * 60 * 1000);
  if (normalized === "1Y") return new Date(now - 365 * 24 * 60 * 60 * 1000);
  if (normalized === "5Y") return new Date(now - 5 * 365 * 24 * 60 * 60 * 1000);
  return null;
}

const SUPPORTED_TRACKED_TICKERS = new Set([
  "BTCWITCH",
  "SOPHIA",
  "GORA",
  "DKDEFI",
  "VAULT",
  "IQYIELD",
  "NOIR",
  "ASTRALFXIQ",
  "VALKI"
]);

iqaiRouter.get("/agents/:ticker/chart", async (req, res) => {
  try {
    const ticker = cleanText(req.params?.ticker).toUpperCase();
    if (!ticker) return res.status(400).json({ error: "ticker is required" });
    if (!SUPPORTED_TRACKED_TICKERS.has(ticker)) {
      return res.status(404).json({ error: "ticker is not tracked" });
    }

    const range = cleanText(req.query?.range).toUpperCase() || "1M";
    const from = toDateOrNull(req.query?.from) || getRangeStart(range);
    const to = toDateOrNull(req.query?.to) || new Date();
    if (from && to && from > to) {
      return res.status(400).json({ error: "from must be before to" });
    }

    const parsedLimit = Number(req.query?.limit);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 1000;

    const snapshot = await getAgentHistorySnapshot({
      ticker,
      from,
      to,
      limit,
      range
    });

    return res.json(snapshot);
  } catch (error) {
    const message = error?.message || String(error);
    console.error("[iqai] chart endpoint failed", message);
    return res.status(500).json({ error: "Could not load chart", details: message });
  }
});

iqaiRouter.get("/agents", async (req, res) => {
  try {
    const baseUrl = normalizeBaseUrl(process.env.IQAI_API_BASE) || "https://app.iqai.com";
    const upstreamUrl = new URL(`${baseUrl}/api/agents`);

    const allowedQueryParams = ["sort", "order", "status", "page", "limit"];
    for (const key of allowedQueryParams) {
      const value = cleanText(req.query?.[key]);
      if (value) upstreamUrl.searchParams.set(key, value);
    }

    const bearer = cleanText(process.env.IQAI_BEARER);
    const headers = { Accept: "application/json" };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    const upstreamResponse = await fetch(upstreamUrl, { headers });
    const bodyText = await upstreamResponse.text();

    res.status(upstreamResponse.status);

    try {
      const json = JSON.parse(bodyText);
      return res.json(json);
    } catch {
      return res.type("text/plain").send(bodyText);
    }
  } catch (error) {
    const message = error?.message || String(error);
    console.error("[iqai] proxy /agents failed", message);
    return res.status(500).json({ error: "IQAI proxy failed", details: message });
  }
});

iqaiRouter.get("/api/*", async (req, res) => {
  try {
    const baseUrl = normalizeBaseUrl(process.env.IQAI_API_BASE) || "https://app.iqai.com";
    const wildcardPath = String(req.params?.[0] || "");

    let decodedPath = "";
    try {
      decodedPath = decodeURIComponent(wildcardPath);
    } catch {
      return res.status(400).json({ error: "Invalid IQAI path" });
    }

    const normalizedPath = decodedPath
      .split("/")
      .filter(Boolean)
      .join("/");
    const upstreamPath = `/api/${normalizedPath}`;

    if (!allowedProxyPaths.has(upstreamPath)) {
      return res.status(403).json({ error: "IQAI path not allowed" });
    }

    const upstreamUrl = new URL(`${baseUrl}${upstreamPath}`);
    const queryIndex = req.originalUrl.indexOf("?");
    if (queryIndex >= 0) {
      upstreamUrl.search = req.originalUrl.slice(queryIndex);
    }

    const bearer = cleanText(process.env.IQAI_BEARER);
    const headers = { Accept: "application/json" };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers
    });

    const bodyText = await upstreamResponse.text();
    res.status(upstreamResponse.status);

    try {
      const json = JSON.parse(bodyText);
      return res.json(json);
    } catch {
      return res.type("text/plain").send(bodyText);
    }
  } catch (error) {
    const message = error?.message || String(error);
    console.error("[iqai] generic proxy failed", message);
    return res.status(500).json({ error: "IQAI proxy failed", details: message });
  }
});

export { iqaiRouter };
