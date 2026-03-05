import { Router } from "express";
import { cleanText } from "../core/utils.js";

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
