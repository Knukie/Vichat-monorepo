import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const SNAPSHOT_RETRY_MS = 15000;
const VALID_RANGES = ["5D", "1M", "3M", "6M", "1Y", "5Y"];
const DEFAULT_RANGE = "1M";

const RANGE_CONFIG = {
  "5D": { intervalSec: 3600, maxPoints: 120 },
  "1M": { intervalSec: 86400, maxPoints: 60 },
  "3M": { intervalSec: 86400, maxPoints: 120 },
  "6M": { intervalSec: 86400, maxPoints: 200 },
  "1Y": { intervalSec: 604800, maxPoints: 80 },
  "5Y": { intervalSec: 2592000, maxPoints: 80 }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILE_PATH = path.resolve(__dirname, "../../data/valki-snapshot.json");
const TIMEFRAMES_FILE_PATH = path.resolve(__dirname, "../../data/valki-timeframes.json");
const LIVE_TIMEFRAMES_FILE_PATH = path.resolve(__dirname, "../../data/valki-timeframes.live.json");

/**
 * @typedef {import("../../types/valkiSnapshot.d.ts").ValkiSnapshot} ValkiSnapshot
 * @typedef {import("../../types/valkiSnapshot.d.ts").ValkiSnapshotRange} ValkiSnapshotRange
 * @typedef {import("../../types/valkiSnapshot.d.ts").ValkiTimeframeCandles} ValkiTimeframeCandles
 * @typedef {import("../../types/valkiSnapshot.d.ts").ValkiSnapshotSource} ValkiSnapshotSource
 */

/** @type {ValkiSnapshot} */
let snapshot = {
  price: 0,
  marketCap: 0,
  change24h: 0,
  series: [],
  candles: [],
  updatedAt: Date.now(),
  range: null,
  source: "seed"
};

/** @type {ValkiTimeframeCandles} */
let timeframeSeedCandles = createEmptyTimeframeCandles();
/** @type {ValkiTimeframeCandles} */
let timeframeCandles = createEmptyTimeframeCandles();

/** @type {ValkiSnapshotSource} */
let snapshotSource = "seed";
let hasLiveStateOnDisk = false;

/** @type {NodeJS.Timeout | null} */
let refreshTimer = null;
/** @type {NodeJS.Timeout | null} */
let retryTimer = null;
let hasStarted = false;

function createEmptyTimeframeCandles() {
  return {
    "5D": [],
    "1M": [],
    "3M": [],
    "6M": [],
    "1Y": [],
    "5Y": []
  };
}

function getUpstreamUrl() {
  return String(process.env.VALKI_STATS_API || "").trim();
}

function getRefreshIntervalMs() {
  const parsed = Number(process.env.VALKI_SNAPSHOT_INTERVAL);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
}

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error(`[VALKI] could not read ${path.basename(filePath)}`, error);
    }
    return null;
  }
}

function safeWriteJson(filePath, value) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error(`[VALKI] could not write ${path.basename(filePath)}`, error);
  }
}

/**
 * @param {unknown} value
 */
function normalizeCandles(value, maxPoints = 200) {
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

  return normalized.length > maxPoints ? normalized.slice(-maxPoints) : normalized;
}

/**
 * @param {unknown} value
 * @returns {ValkiSnapshotRange | null}
 */
function normalizeRange(value) {
  const range = String(value || "").trim().toUpperCase();
  return VALID_RANGES.includes(range) ? /** @type {ValkiSnapshotRange} */ (range) : null;
}

function loadSeedTimeframes() {
  const parsed = safeReadJson(TIMEFRAMES_FILE_PATH);
  if (!parsed || typeof parsed !== "object") return;

  timeframeSeedCandles = /** @type {ValkiTimeframeCandles} */ (
    VALID_RANGES.reduce((acc, range) => {
      acc[range] = normalizeCandles(parsed[range], RANGE_CONFIG[range].maxPoints);
      return acc;
    }, createEmptyTimeframeCandles())
  );

  timeframeCandles = cloneTimeframeCandles(timeframeSeedCandles);
}

function loadLiveTimeframes() {
  const parsed = safeReadJson(LIVE_TIMEFRAMES_FILE_PATH);
  if (!parsed || typeof parsed !== "object") return;

  hasLiveStateOnDisk = true;

  for (const range of VALID_RANGES) {
    const liveCandles = normalizeCandles(parsed[range], RANGE_CONFIG[range].maxPoints);
    if (liveCandles.length) {
      timeframeCandles[range] = liveCandles;
    }
  }
}

/**
 * @param {ValkiTimeframeCandles} source
 */
function cloneTimeframeCandles(source) {
  return /** @type {ValkiTimeframeCandles} */ (
    VALID_RANGES.reduce((acc, range) => {
      acc[range] = normalizeCandles(source[range], RANGE_CONFIG[range].maxPoints);
      return acc;
    }, createEmptyTimeframeCandles())
  );
}

function fetchSnapshotFromDisk() {
  const parsed = safeReadJson(SNAPSHOT_FILE_PATH);
  if (!parsed || typeof parsed !== "object") return null;

  const price = Number(parsed.price);
  const marketCap = Number(parsed.marketCap);
  const change24h = Number(parsed.change24h);
  const updatedAt = Number(parsed.updatedAt);

  return {
    price: Number.isFinite(price) ? price : 0,
    marketCap: Number.isFinite(marketCap) ? marketCap : 0,
    change24h: Number.isFinite(change24h) ? change24h : 0,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now()
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

/**
 * @param {ValkiSnapshotRange} range
 * @param {number} livePrice
 * @param {number} nowSec
 */
function updateRangeRollingCandle(range, livePrice, nowSec) {
  const config = RANGE_CONFIG[range];
  const bucketStart = Math.floor(nowSec / config.intervalSec) * config.intervalSec;
  const candles = normalizeCandles(timeframeCandles[range], config.maxPoints);
  const previous = candles[candles.length - 1];

  if (previous && previous.time === bucketStart) {
    previous.high = Math.max(previous.high, livePrice);
    previous.low = Math.min(previous.low, livePrice);
    previous.close = livePrice;
  } else {
    candles.push({
      time: bucketStart,
      open: previous?.close ?? livePrice,
      high: livePrice,
      low: livePrice,
      close: livePrice
    });
  }

  timeframeCandles[range] = candles.length > config.maxPoints ? candles.slice(-config.maxPoints) : candles;
}

/**
 * @param {ValkiSnapshotRange | null} requestedRange
 */
function buildSnapshot(requestedRange = null) {
  const rangeToUse = requestedRange || DEFAULT_RANGE;
  const candles = normalizeCandles(timeframeCandles[rangeToUse], RANGE_CONFIG[rangeToUse].maxPoints);
  const series = candles.map((candle) => candle.close);
  const lastClose = series.length ? series[series.length - 1] : snapshot.price;

  return {
    price: Number.isFinite(lastClose) ? lastClose : 0,
    marketCap: snapshot.marketCap,
    change24h: snapshot.change24h,
    series,
    candles,
    updatedAt: snapshot.updatedAt || Date.now(),
    range: requestedRange,
    source: snapshotSource
  };
}

function persistState() {
  safeWriteJson(LIVE_TIMEFRAMES_FILE_PATH, timeframeCandles);
  safeWriteJson(SNAPSHOT_FILE_PATH, snapshot);
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

    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);

    // Roll alle ranges vooruit met dezelfde live prijs.
    for (const range of VALID_RANGES) {
      updateRangeRollingCandle(range, stats.price, nowSec);
    }

    snapshotSource = hasLiveStateOnDisk || hasSeedData() ? "live+seed" : "live";
    hasLiveStateOnDisk = true;
    snapshot = {
      ...snapshot,
      price: stats.price,
      marketCap: stats.marketCap,
      change24h: stats.change24h,
      updatedAt: nowMs
    };

    snapshot = buildSnapshot(null);
    persistState();

    console.info("[VALKI] Snapshot updated");
    return snapshot;
  } catch (error) {
    console.error("[VALKI] snapshot error", error);
    snapshotSource = "fallback";
    snapshot = buildSnapshot(null);
    safeWriteJson(SNAPSHOT_FILE_PATH, snapshot);
    scheduleRetry();
    return snapshot;
  }
}

function hasSeedData() {
  return VALID_RANGES.some((range) => timeframeSeedCandles[range].length > 0);
}

/**
 * @param {string | undefined | null} [range]
 * @returns {ValkiSnapshot}
 */
export function getValkiSnapshot(range) {
  const selectedRange = normalizeRange(range);

  if (!range) {
    return buildSnapshot(null);
  }

  if (!selectedRange) {
    return buildSnapshot(null);
  }

  return buildSnapshot(selectedRange);
}

export async function startValkiSnapshotScheduler() {
  if (hasStarted) return;
  hasStarted = true;

  loadSeedTimeframes();
  loadLiveTimeframes();

  const diskSnapshot = fetchSnapshotFromDisk();
  if (diskSnapshot) {
    snapshot = {
      ...snapshot,
      ...diskSnapshot
    };
  }

  snapshotSource = hasLiveStateOnDisk ? "live+seed" : hasSeedData() ? "seed" : "fallback";
  snapshot = buildSnapshot(null);
  safeWriteJson(SNAPSHOT_FILE_PATH, snapshot);

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
