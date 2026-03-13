import fs from "fs/promises";
import path from "path";
import { Client } from "pg";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function extractTickerFromFilename(filename) {
  const baseName = path.basename(filename, path.extname(filename));

  // Preferred parsing: split at IPFS hash marker (bafy/bafk), then take leading [A-Z0-9]+.
  const hashMarkerIdx = baseName.search(/bafy|bafk/i);
  const beforeHash = hashMarkerIdx >= 0 ? baseName.slice(0, hashMarkerIdx) : baseName;
  const prefixMatch = beforeHash.match(/^([A-Z0-9]+)/);
  if (prefixMatch?.[1]) {
    return prefixMatch[1].toUpperCase();
  }

  return "";
}

async function listImageFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  const args = parseArgs();
  const dirArg = String(args.dir || "").trim();
  const baseUrl = String(args.baseUrl || "").trim().replace(/\/$/, "");
  const dryRun = isTruthy(args.dryRun);

  if (!dirArg) {
    throw new Error("Missing required argument --dir <folder>");
  }

  const directory = path.resolve(dirArg);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const files = await listImageFiles(directory);
    let matched = 0;
    let updated = 0;
    let skipped = 0;

    for (const fileName of files) {
      const ticker = extractTickerFromFilename(fileName);
      if (!ticker) {
        skipped += 1;
        console.log(`[skipped file] ${fileName} (no ticker found)`);
        continue;
      }

      matched += 1;
      const resolvedImageValue = baseUrl
        ? `${baseUrl}/${encodeURIComponent(fileName)}`
        : path.join(directory, fileName);

      const existingResult = await client.query(
        `SELECT "ticker", COALESCE("desktop_image_url", '') AS "desktop_image_url"
           FROM "agents"
          WHERE "ticker" = $1
          LIMIT 1`,
        [ticker]
      );

      const currentValue = String(existingResult.rows[0]?.desktop_image_url || "");
      if (currentValue === resolvedImageValue) {
        console.log(`[matched ticker] ${fileName} -> ${ticker}`);
        console.log(`[skipped file] ${fileName} (already up-to-date)`);
        skipped += 1;
        continue;
      }

      const result = dryRun
        ? { rowCount: 1, rows: [{ ticker, desktop_image_url: resolvedImageValue }] }
        : await client.query(
          `INSERT INTO "agents" ("ticker", "desktop_image_url")
           VALUES ($1, $2)
           ON CONFLICT ("ticker")
           DO UPDATE SET "desktop_image_url" = EXCLUDED."desktop_image_url", "updated_at" = NOW()
           RETURNING "ticker", "desktop_image_url"`,
          [ticker, resolvedImageValue]
        );

      console.log(`[matched ticker] ${fileName} -> ${ticker}`);
      if (dryRun) {
        console.log(`[updated record] DRY RUN ${ticker} -> ${resolvedImageValue}`);
      } else {
        console.log(`[updated record] ${ticker} -> ${result.rows[0].desktop_image_url}`);
      }
      updated += 1;
    }

    console.log(`\nDone. files=${files.length} matched=${matched} updated=${updated} skipped=${skipped}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("importDesktopImageOverrides failed:", error?.message || error);
  process.exitCode = 1;
});
