import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const MAX_SERIES_POINTS = 40;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILE_PATH = path.resolve(__dirname, "../../data/valki-snapshot.json");

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
let hasStarted = false;

function getUpstreamUrl() {
  return String(process.env.VALKI_STATS_API || "").trim();
}

function getRefreshIntervalMs() {
  const parsed = Number(process.env.VALKI_SNAPSHOT_INTERVAL);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
}

function isValidSnapshot(candidate) {
  return (
    candidate &&
    typeof candidate.price === "number" &&
    typeof candidate.marketCap === "number" &&
    typeof candidate.change24h === "number" &&
    typeof candidate.updatedAt === "number" &&
    Array.isArray(candidate.series) &&
    candidate.series.every((point) => typeof point === "number")
  );
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
    if (!isValidSnapshot(parsed)) return null;

    return {
      ...parsed,
      series: parsed.series.slice(-MAX_SERIES_POINTS)
    };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    console.error("[VALKI] Snapshot refresh failed", error);
    return null;
  }
}

export async function refreshValkiSnapshot() {
  try {
    const stats = await fetchValkiStats();
    const existingSeries = Array.isArray(snapshot?.series) ? snapshot.series : [];
    const nextSeries = [...existingSeries, stats.price].slice(-MAX_SERIES_POINTS);

    const nextSnapshot = {
      price: stats.price,
      marketCap: stats.marketCap,
      change24h: stats.change24h,
      series: nextSeries,
      updatedAt: Date.now()
    };

    snapshot = nextSnapshot;
    writeSnapshotToDisk(nextSnapshot);
    console.info("[VALKI] Snapshot updated");
    return nextSnapshot;
  } catch (error) {
    console.error("[VALKI] Snapshot refresh failed", error);
    return snapshot;
  }
}

export function getValkiSnapshot() {
  return snapshot;
}

export async function startValkiSnapshotScheduler() {
  if (hasStarted) return;
  hasStarted = true;

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
  hasStarted = false;
}
