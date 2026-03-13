import { findDesktopImageOverridesByTickers } from "../repositories/agentImageOverrideRepository.js";

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

export async function mergeDesktopImageOverrides(prisma, agentsPayload) {
  if (!agentsPayload || typeof agentsPayload !== "object") return agentsPayload;
  const agents = Array.isArray(agentsPayload.agents) ? agentsPayload.agents : null;
  if (!agents) return agentsPayload;

  const tickers = agents.map((agent) => normalizeTicker(agent?.ticker)).filter(Boolean);
  const overridesByTicker = await findDesktopImageOverridesByTickers(prisma, tickers);

  const mergedAgents = agents.map((agent) => {
    const ticker = normalizeTicker(agent?.ticker);
    if (!ticker) return agent;

    const desktopImageUrl = overridesByTicker.get(ticker);
    if (!desktopImageUrl) return agent;

    return {
      ...agent,
      desktop_image_url: desktopImageUrl
    };
  });

  return {
    ...agentsPayload,
    agents: mergedAgents
  };
}
