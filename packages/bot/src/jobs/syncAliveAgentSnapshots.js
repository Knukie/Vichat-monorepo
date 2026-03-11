import {
  disconnectAgentSnapshotDb,
  syncAliveAgentPriceSnapshots
} from "../services/agentPriceSnapshots.js";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

let timer = null;
let running = false;
let inFlightRun = null;

function getIntervalMs() {
  const parsed = Number(process.env.AGENT_SNAPSHOT_INTERVAL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
}

async function runOnce() {
  if (running) return inFlightRun;
  running = true;
  inFlightRun = (async () => {
    try {
      const result = await syncAliveAgentPriceSnapshots();
      console.info("[snapshots] sync complete", result);
    } catch (error) {
      console.error("[snapshots] sync run failed", error);
    } finally {
      running = false;
      inFlightRun = null;
    }
  })();

  return inFlightRun;
}

export async function startAliveAgentSnapshotScheduler() {
  if (timer) return;
  await runOnce();
  timer = setInterval(runOnce, getIntervalMs());
}

export async function stopAliveAgentSnapshotScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (inFlightRun) await inFlightRun;
  await disconnectAgentSnapshotDb();
}
