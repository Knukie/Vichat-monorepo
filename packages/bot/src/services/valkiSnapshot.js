import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const MAX_SERIES_POINTS = 200;
const SNAPSHOT_RETRY_MS = 15000;
const VALID_RANGES = ["5D", "1M", "3M", "6M", "1Y", "5Y"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILE_PATH = path.resolve(__dirname, "../../data/valki-snapshot.json");
const TIMEFRAMES_FILE_PATH = path.resolve(__dirname, "../../data/valki-timeframes.json");

/**
 * @typedef {import("../../types/valkiSnapshot.d.ts").ValkiSnapshot} ValkiSnapshot
 * @typedef {import("../../types/valkiSnapshot.d.ts").ValkiSnapshotRange} ValkiSnapshotRange
 * @typedef {import("../../types/valkiSnapshot.d.ts").ValkiTimeframeCandles} ValkiTimeframeCandles
 */

/** @type {ValkiSnapshot} */
let snapshot = {
  price: 0,
  marketCap: 0,
  change24h: 0,
  series: [],
  candles: [],
  updatedAt: Date.now()
};
/** @type {ValkiTimeframeCandles} */
let timeframeCandles = {
  "5D": [],
  "1M": [],
  "3M": [],
  "6M": [],
  "1Y": [],
  "5Y": []
};
/** @type {NodeJS.Timeout | null} */
let refreshTimer = null;
/** @type {NodeJS.Timeout | null} */
let retryTimer = null;
let hasStarted = false;

function getUpstreamUrl() {
  return String(process.env.VALKI_STATS_API || "").trim();
}

function getRefreshIntervalMs() {
  const parsed = Number(process.env.VALKI_SNAPSHOT_INTERVAL);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
}

/**
 * @param {unknown} value
 */
function normalizeSeries(value) {
  const series = Array.isArray(value)
    ? value.map((point) => Number(point)).filter((point) => Number.isFinite(point))
    : [];
  return series.length > MAX_SERIES_POINTS ? series.slice(-MAX_SERIES_POINTS) : series;
}

/**
 * @param {unknown} value
 */
function normalizeCandles(value) {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((candle) => {
      if (!candle || typeof candle !== "object") return null;
      const next = {
        time: Number(candle.time),
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close)
      };

      if (
        !Number.isFinite(next.time) ||
        !Number.isFinite(next.open) ||
        !Number.isFinite(next.high) ||
        !Number.isFinite(next.low) ||
        !Number.isFinite(next.close)
      ) {
        return null;
      }

      return next;
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  return normalized.length > MAX_SERIES_POINTS ? normalized.slice(-MAX_SERIES_POINTS) : normalized;
}

/**
 * @param {unknown} value
 * @returns {ValkiSnapshotRange | null}
 */
function normalizeRange(value) {
  const range = String(value || "").trim().toUpperCase();
  return VALID_RANGES.includes(range) ? /** @type {ValkiSnapshotRange} */ (range) : null;
}

function loadTimeframeCandlesFromDisk() {
  try {
    const raw = fs.readFileSync(TIMEFRAMES_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") return;

    timeframeCandles = {
      "5D": normalizeCandles(parsed["5D"]),
      "1M": normalizeCandles(parsed["1M"]),
      "3M": normalizeCandles(parsed["3M"]),
      "6M": normalizeCandles(parsed["6M"]),
      "1Y": normalizeCandles(parsed["1Y"]),
      "5Y": normalizeCandles(parsed["5Y"])
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("[VALKI] timeframe dataset error", error);
    }
  }
}

/**
 * @param {ValkiSnapshotRange} range
 */
function getCandlesForRange(range) {
  const selected = timeframeCandles[range];
  return {
    range,
    candles: normalizeCandles(selected)
  };
}

async function fetchValkiStats() {
  const upstreamUrl = getUpstreamUrl();
  if (!upstreamUrl) {
    throw new Error("VALKI_STATS_API is not configured");
  }

  const response = await fetch(upstreamUrl);
  if (!response.ok) {
    throw new Error(`Upstream stats error (${response.status})`);
  }

  const data = await response.json();
  const agent = Array.isArray(data) ? data[0] : data;

  const price = Number(agent?.currentPriceInUSD);
  const marketCap = Number(agent?.marketCap);
  const change24h = Number(agent?.priceChangeIn24h);

  if (!Number.isFinite(price) || !Number.isFinite(marketCap) || !Number.isFinite(change24h)) {
    throw new Error("Upstream stats payload is missing numeric fields");
  }

  return { price, marketCap, change24h };
}

function writeSnapshotToDisk(nextSnapshot) {
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE_PATH, `${JSON.stringify(nextSnapshot, null, 2)}\n`, "utf8");
}

function loadSnapshotFromDisk() {
  try {
    const raw = fs.readFileSync(SNAPSHOT_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (!Array.isArray(parsed.series)) parsed.series = [];
    if (!Array.isArray(parsed.candles)) parsed.candles = [];

    const price = Number(parsed.price);
    const marketCap = Number(parsed.marketCap);
    const change24h = Number(parsed.change24h);
    const updatedAt = Number(parsed.updatedAt);

    const nextSnapshot = {
      price: Number.isFinite(price) ? price : 0,
      marketCap: Number.isFinite(marketCap) ? marketCap : 0,
      change24h: Number.isFinite(change24h) ? change24h : 0,
      series: normalizeSeries(parsed.series),
      candles: normalizeCandles(parsed.candles),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now()
    };

    return nextSnapshot;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    console.error("[VALKI] snapshot error", error);
    return null;
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    await refreshValkiSnapshot();
  }, SNAPSHOT_RETRY_MS);
}

export async function refreshValkiSnapshot() {
  try {
    const stats = await fetchValkiStats();

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    const nextSeries = normalizeSeries([
      ...(Array.isArray(snapshot.series) ? snapshot.series : []),
      stats.price
    ]);

    snapshot = {
      ...snapshot,
      price: stats.price,
      marketCap: stats.marketCap,
      change24h: stats.change24h,
      series: nextSeries,
      candles: Array.isArray(snapshot.candles) ? snapshot.candles : [],
      updatedAt: Date.now()
    };

    writeSnapshotToDisk(snapshot);
    console.info("[VALKI] Snapshot updated");
    return snapshot;
  } catch (error) {
    console.error("[VALKI] snapshot error", error);
    scheduleRetry();
    return snapshot;
  }
}

/**
 * @param {string | undefined | null} [range]
 * @returns {ValkiSnapshot}
 */
export function getValkiSnapshot(range) {
  if (!range) {
    return snapshot;
  }

  const selectedRange = normalizeRange(range);
  if (!selectedRange) {
    return snapshot;
  }

  const { candles } = getCandlesForRange(selectedRange);
  const series = normalizeSeries(candles.map((candle) => candle.close));

  return {
    ...snapshot,
    range: selectedRange,
    candles,
    series,
    price: series.length ? series[series.length - 1] : snapshot.price
  };
}

export async function startValkiSnapshotScheduler() {
  if (hasStarted) return;
  hasStarted = true;

  loadTimeframeCandlesFromDisk();

  const diskSnapshot = loadSnapshotFromDisk();
  if (diskSnapshot) {
    snapshot = diskSnapshot;
  }

  await refreshValkiSnapshot();

  refreshTimer = setInterval(() => {
    refreshValkiSnapshot();
  }, getRefreshIntervalMs());
}

export function stopValkiSnapshotScheduler() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  hasStarted = false;
}
