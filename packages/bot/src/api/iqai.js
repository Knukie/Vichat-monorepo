import { Router } from "express";
import { cleanText } from "../core/utils.js";

const iqaiRouter = Router();

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

export { iqaiRouter };
