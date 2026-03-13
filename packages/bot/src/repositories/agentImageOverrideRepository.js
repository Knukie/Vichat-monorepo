import { Prisma } from "@prisma/client";

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

  const [{ exists: agentsTableExists = false } = {}] = await prisma.$queryRaw(
    Prisma.sql`SELECT to_regclass('agents') IS NOT NULL AS "exists"`
  );

  if (!agentsTableExists) {
    console.info("[iqai] agents table unavailable; skipping desktop image overrides");
    return new Map();
  }

  const rows = await prisma.$queryRaw(
    Prisma.sql`
      SELECT UPPER("ticker") AS "ticker", "desktop_image_url" AS "desktopImageUrl"
      FROM "agents"
      WHERE UPPER("ticker") IN (${Prisma.join(normalized)})
        AND "desktop_image_url" IS NOT NULL
        AND "desktop_image_url" <> ''
    `
  );

  return new Map(rows.map((row) => [String(row.ticker || "").toUpperCase(), String(row.desktopImageUrl || "")]));
}
