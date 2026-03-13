function normalizeTickers(tickers = []) {
  return Array.from(new Set(
    tickers
      .map((ticker) => String(ticker || "").trim().toUpperCase())
      .filter(Boolean)
  ));
}

/**
 * Reads desktop image overrides from the agents table for the requested tickers.
 * Returns an uppercase ticker keyed map so callers can merge overrides case-insensitively.
 */
export async function findDesktopImageOverridesByTickers(prisma, tickers = []) {
  const normalized = normalizeTickers(tickers);
  if (!normalized.length) return new Map();

  try {
    const rows = await prisma.agent.findMany({
      where: {
        ticker: { in: normalized },
        desktopImageUrl: { not: null }
      },
      select: {
        ticker: true,
        desktopImageUrl: true
      }
    });

    return new Map(
      rows
        .filter((row) => String(row.desktopImageUrl || "").trim())
        .map((row) => [String(row.ticker || "").toUpperCase(), String(row.desktopImageUrl || "")])
    );
  } catch (error) {
    if (error?.code === "P2021") {
      console.info("[iqai] agents table unavailable; skipping desktop image overrides");
      return new Map();
    }
    throw error;
  }
}
