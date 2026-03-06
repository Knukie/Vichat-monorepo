import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const UPSTREAM_URL =
  "https://auth.valki.wiki/api/iqai/api/agents/stats?ticker=VALKI";
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MAX_SERIES_POINTS = 40;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILE_PATH = path.resolve(__dirname, "../../data/valki-snapshot.json");

/**
 * @typedef {Object} ValkiSnapshot
 * @property {number} price
 * @property {number} marketCap
 * @property {number} change24h
 * @property {number[]} series
 * @property {number} updatedAt
 */

/** @type {ValkiSnapshot | null} */
let snapshot = null;
/** @type {NodeJS.Timeout | null} */
let refreshTimer = null;
let hasStarted = false;

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
  const response = await fetch(UPSTREAM_URL);
  if (!response.ok) {
    throw new Error(`Upstream stats error (${response.status})`);
  }

  const data = await response.json();
  const agent = Array.isArray(data) ? data[0] : null;

  const price = Number(agent?.currentPriceInUSD);
  const marketCap = Number(agent?.marketCap);
  const change24h = Number(agent?.priceChangeIn24h);

  if (!Number.isFinite(price) || !Number.isFinite(marketCap) || !Number.isFinite(change24h)) {
    throw new Error("Upstream stats payload is missing numeric fields");
  }

  return { price, marketCap, change24h };
}

async function writeSnapshotToDisk(nextSnapshot) {
  await fs.mkdir(path.dirname(SNAPSHOT_FILE_PATH), { recursive: true });
  await fs.writeFile(SNAPSHOT_FILE_PATH, `${JSON.stringify(nextSnapshot, null, 2)}\n`, "utf8");
}

async function loadSnapshotFromDisk() {
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE_PATH, "utf8");
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

/**
 * Snapshot refresh flow:
 * 1) pull latest VALKI stats from upstream,
 * 2) append latest price to the existing sparkline series,
 * 3) trim the series to the most recent 40 points,
 * 4) store in memory and persist to disk.
 */
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
    await writeSnapshotToDisk(nextSnapshot);
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

  const diskSnapshot = await loadSnapshotFromDisk();
  if (diskSnapshot) {
    snapshot = diskSnapshot;
  } else {
    await refreshValkiSnapshot();
  }

  refreshTimer = setInterval(() => {
    refreshValkiSnapshot();
  }, REFRESH_INTERVAL_MS);
}

export function stopValkiSnapshotScheduler() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  hasStarted = false;
}
