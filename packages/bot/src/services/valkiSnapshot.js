import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const MAX_SERIES_POINTS = 200;
const SNAPSHOT_RETRY_MS = 15000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const FILE_PATH = path.resolve(DATA_DIR, "valki-snapshot.json");

/**
 * @typedef {import("../../types/valkiSnapshot.d.ts").ValkiSnapshot} ValkiSnapshot
 */

/** @type {ValkiSnapshot} */
let snapshot = {
  price: 0,
  marketCap: 0,
  change24h: 0,
  series: [],
  updatedAt: Date.now()
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
  const payload = Array.isArray(data) ? data[0] : data;

  const price = Number(payload?.currentPriceInUSD);
  const marketCap = Number(payload?.marketCap);
  const change24h = Number(payload?.priceChangeIn24h);

  if (!Number.isFinite(price) || !Number.isFinite(marketCap) || !Number.isFinite(change24h)) {
    throw new Error("Upstream stats payload is missing numeric fields");
  }

  return { price, marketCap, change24h };
}

function writeSnapshotToDisk() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(snapshot, null, 2));
}

function loadSnapshotFromDisk() {
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const loadedSnapshot = {
      price: Number.isFinite(Number(parsed.price)) ? Number(parsed.price) : 0,
      marketCap: Number.isFinite(Number(parsed.marketCap)) ? Number(parsed.marketCap) : 0,
      change24h: Number.isFinite(Number(parsed.change24h)) ? Number(parsed.change24h) : 0,
      updatedAt: Number.isFinite(Number(parsed.updatedAt)) ? Number(parsed.updatedAt) : Date.now(),
      series: Array.isArray(parsed.series)
        ? parsed.series.filter((point) => Number.isFinite(Number(point))).map((point) => Number(point))
        : []
    };

    if (!Array.isArray(loadedSnapshot.series)) loadedSnapshot.series = [];

    if (loadedSnapshot.series.length > MAX_SERIES_POINTS) {
      loadedSnapshot.series = loadedSnapshot.series.slice(-MAX_SERIES_POINTS);
    }

    snapshot = loadedSnapshot;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("[VALKI] snapshot error", error);
    }
  }
}

export async function refreshValkiSnapshot() {
  try {
    const { price, marketCap, change24h } = await fetchValkiStats();

    snapshot.series.push(price);
    if (snapshot.series.length > MAX_SERIES_POINTS) {
      snapshot.series = snapshot.series.slice(-MAX_SERIES_POINTS);
    }

    snapshot.price = price;
    snapshot.marketCap = marketCap;
    snapshot.change24h = change24h;
    snapshot.updatedAt = Date.now();

    writeSnapshotToDisk();
    return snapshot;
  } catch (error) {
    console.error("[VALKI] snapshot error", error);

    if (retryTimer) {
      clearTimeout(retryTimer);
    }

    retryTimer = setTimeout(() => {
      retryTimer = null;
      refreshValkiSnapshot();
    }, SNAPSHOT_RETRY_MS);

    return snapshot;
  }
}

export function getValkiSnapshot() {
  return snapshot;
}

export async function startValkiSnapshotScheduler() {
  if (hasStarted) return;
  hasStarted = true;

  loadSnapshotFromDisk();
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
