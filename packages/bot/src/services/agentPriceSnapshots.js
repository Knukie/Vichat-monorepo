import { PrismaClient } from "@prisma/client";
import { cleanText } from "../core/utils.js";

const prisma = new PrismaClient();
const DEFAULT_BASE_URL = "https://app.iqai.com";
const DEFAULT_SOURCE = "iqai";
const DEFAULT_TRACKED_TICKERS = [
  "BTCWITCH",
  "SOPHIA",
  "GORA",
  "DKDEFI",
  "VAULT",
  "IQYIELD",
  "NOIR",
  "ASTRALFXIQ",
  "VALKI"
];

function normalizeBaseUrl(url) {
  return cleanText(url).replace(/\/+$/, "");
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTicker(value) {
  const ticker = cleanText(value).toUpperCase();
  return ticker || null;
}

function getTrackedTickersFromEnv() {
  const raw = cleanText(process.env.TRACKED_AGENT_TICKERS);

  if (!raw) {
    return [...DEFAULT_TRACKED_TICKERS];
  }

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => toTicker(value))
        .filter(Boolean)
    )
  );
}

function pickAgentList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.agents)) return payload.data.agents;
  if (Array.isArray(payload?.agents)) return payload.agents;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function pickStatsRow(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.data && typeof payload.data === "object") return payload.data;
  if (payload.stats && typeof payload.stats === "object") return payload.stats;
  return payload;
}

function isAlive(agent) {
  if (!agent || typeof agent !== "object") return false;
  if (agent.isAlive === true || agent.alive === true) return true;
  if (agent.isActive === true || agent.active === true) return true;

  const status = cleanText(agent.status).toLowerCase();
  return status === "alive" || status === "active" || status === "live";
}

async function iqaiFetch(pathname, searchParams = new URLSearchParams()) {
  const baseUrl = normalizeBaseUrl(process.env.IQAI_API_BASE) || DEFAULT_BASE_URL;
  const url = new URL(`${baseUrl}${pathname}`);
  url.search = searchParams.toString();

  const bearer = cleanText(process.env.IQAI_BEARER);
  const headers = { Accept: "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const response = await fetch(url, { method: "GET", headers });
  const bodyText = await response.text();

  if (!response.ok) {
    console.error("[snapshots] IQAI upstream request failed", {
      url: url.toString(),
      status: response.status,
      body: bodyText.slice(0, 2000)
    });
    throw new Error(`IQAI ${pathname} request failed (${response.status})`);
  }

  if (!bodyText) return null;

  try {
    return JSON.parse(bodyText);
  } catch (error) {
    console.error("[snapshots] IQAI upstream returned non-JSON body", {
      url: url.toString(),
      status: response.status,
      body: bodyText.slice(0, 2000)
    });
    throw new Error(`IQAI ${pathname} returned non-JSON response`);
  }
}


async function fetchAliveAgents() {
  const params = new URLSearchParams();
  params.set("status", "alive");
  params.set("limit", "250");

  const payload = await iqaiFetch("/api/agents/info", params);
  const agents = pickAgentList(payload);
  const alive = agents.filter(isAlive);
  if (alive.length > 0) return alive;
  // Upstream already applies status=alive; fall back when local flags are missing.
  return agents;
}

async function fetchPricesByTicker() {
  const payload = await iqaiFetch("/api/prices", new URLSearchParams());
  const prices = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.prices)
      ? payload.prices
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return new Map(
    prices
      .map((item) => [toTicker(item?.ticker || item?.symbol), item])
      .filter(([ticker]) => Boolean(ticker))
  );
}

async function fetchAgentStatsByTicker(ticker) {
  if (!ticker) return null;
  try {
    const params = new URLSearchParams({ ticker });
    const payload = await iqaiFetch("/api/agents/stats", params);
    return pickStatsRow(payload);
  } catch (error) {
    console.warn(`[snapshots] stats fetch failed for ${ticker}:`, error?.message || error);
    return null;
  }
}

function normalizeSnapshotRecord({ agent, ticker, priceRow, statsRow, source, recordedAt }) {
  const priceUsd = toFiniteNumber(
    priceRow?.currentPriceInUSD ??
      priceRow?.priceUsd ??
      priceRow?.usd ??
      priceRow?.priceUSD ??
      agent?.currentPriceInUSD
  );

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return null;
  }

  const priceIq = toFiniteNumber(priceRow?.currentPriceInIq ?? priceRow?.priceIq ?? agent?.currentPriceInIq);
  const marketCap = toFiniteNumber(
    statsRow?.marketCap ??
      statsRow?.market_cap ??
      priceRow?.marketCap ??
      priceRow?.market_cap ??
      agent?.marketCap
  );
  const liquidityUsd = toFiniteNumber(
    statsRow?.liquidityUsd ??
      statsRow?.liquidity_usd ??
      statsRow?.liquidity ??
      priceRow?.liquidityUsd ??
      priceRow?.liquidity_usd ??
      priceRow?.liquidity
  );
  const volume24hUsd = toFiniteNumber(
    statsRow?.volume24hUsd ??
      statsRow?.volume_24h_usd ??
      statsRow?.volume24h ??
      statsRow?.volume24hInUSD ??
      statsRow?.volume24h_in_usd ??
      priceRow?.volume24hUsd ??
      priceRow?.volume_24h_usd ??
      priceRow?.volume24h
  );

  return {
    ticker,
    agentId: cleanText(agent?.id || statsRow?.id || statsRow?.agentId) || null,
    priceUsd,
    priceIq,
    marketCap,
    liquidityUsd,
    volume24hUsd,
    source: source || DEFAULT_SOURCE,
    recordedAt
  };
}

export async function syncAliveAgentPriceSnapshots() {
  const recordedAt = new Date();
  const source = cleanText(process.env.AGENT_SNAPSHOT_SOURCE) || DEFAULT_SOURCE;
  const trackedTickers = getTrackedTickersFromEnv();

  const agents = trackedTickers.length
    ? trackedTickers.map((ticker) => ({ ticker, status: "tracked" }))
    : await fetchAliveAgents();

  if (trackedTickers.length) {
    console.info("[snapshots] using TRACKED_AGENT_TICKERS override", {
      tickers: trackedTickers,
      count: trackedTickers.length
    });
  } else {
    console.info("[snapshots] using upstream alive agent list", {
      count: agents.length
    });
  }

  const pricesByTicker = await fetchPricesByTicker();

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const agent of agents) {
    const ticker = toTicker(agent?.ticker || agent?.symbol);
    if (!ticker) {
      skipped += 1;
      continue;
    }

    try {
      const priceRow = pricesByTicker.get(ticker) || null;
      const statsRow = await fetchAgentStatsByTicker(ticker);
      const record = normalizeSnapshotRecord({
        agent,
        ticker,
        priceRow,
        statsRow,
        source,
        recordedAt
      });

      if (!record) {
        skipped += 1;
        console.info(`[snapshots] skipped ${ticker}: missing valid price`);
        continue;
      }

      await prisma.agentPriceSnapshot.upsert({
        where: {
          ticker_recordedAt: {
            ticker,
            recordedAt
          }
        },
        update: {
          agentId: record.agentId,
          priceUsd: record.priceUsd,
          priceIq: record.priceIq,
          marketCap: record.marketCap,
          liquidityUsd: record.liquidityUsd,
          volume24hUsd: record.volume24hUsd,
          source: record.source
        },
        create: record
      });

      inserted += 1;
    } catch (error) {
      failed += 1;
      console.error(`[snapshots] failed for ${ticker}:`, error?.message || error);
    }
  }

  return {
    recordedAt: recordedAt.getTime(),
    totalAgents: agents.length,
    inserted,
    skipped,
    failed
  };
}

export async function getAgentChartPoints({ ticker, from, to, limit = 500 }) {
  const normalizedTicker = toTicker(ticker);
  if (!normalizedTicker) return [];

  const where = {
    ticker: normalizedTicker,
    ...(from || to
      ? {
          recordedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {})
          }
        }
      : {})
  };

  const cappedLimit = Math.min(Math.max(Number(limit) || 500, 1), 5000);
  const snapshots = await prisma.agentPriceSnapshot.findMany({
    where,
    orderBy: { recordedAt: "desc" },
    take: cappedLimit
  });

  return snapshots.reverse().map((row) => ({
    time: row.recordedAt.getTime(),
    value: Number(row.priceUsd),
    source: cleanText(row.source) || DEFAULT_SOURCE,
    priceIq: row.priceIq == null ? null : Number(row.priceIq),
    marketCap: row.marketCap == null ? null : Number(row.marketCap),
    liquidityUsd: row.liquidityUsd == null ? null : Number(row.liquidityUsd),
    volume24hUsd: row.volume24hUsd == null ? null : Number(row.volume24hUsd)
  }));
}

function toCandle(point) {
  return {
    time: point.time,
    open: point.value,
    high: point.value,
    low: point.value,
    close: point.value
  };
}

function computeChange24h(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;

  const latest = points[points.length - 1];
  const targetTime = latest.time - 24 * 60 * 60 * 1000;

  let baseline = points[0];
  for (const point of points) {
    if (point.time <= targetTime) baseline = point;
    else break;
  }

  if (!baseline?.value || baseline.value <= 0) return 0;
  return ((latest.value - baseline.value) / baseline.value) * 100;
}

export async function getAgentHistorySnapshot({ ticker, from, to, limit = 1000, range = null }) {
  const points = await getAgentChartPoints({ ticker, from, to, limit });
  const candles = points.map(toCandle);
  const latest = points[points.length - 1] || null;

  return {
    ticker: toTicker(ticker),
    price: latest?.value ?? 0,
    marketCap: latest?.marketCap ?? 0,
    change24h: computeChange24h(points),
    series: candles.map((candle) => candle.close),
    candles,
    updatedAt: latest?.time ?? Date.now(),
    range,
    source: latest?.source || DEFAULT_SOURCE,
    points
  };
}

export async function disconnectAgentSnapshotDb() {
  await prisma.$disconnect();
}
