import { Client } from "pg";

const DESKTOP_IMAGE_OVERRIDES = {
  BTCWITCH:
    "https://valki.wiki/onewebmedia/BTCWITCHbafybeicpemr73gfjkh73e3mtp52klpijqadleaulzrs6ypxg46p46cyday.jpg",
  SOPHIA:
    "https://valki.wiki/onewebmedia/SOPHIAbafkreicuhh5rc4k3ojqnwfysdopvmlb644lfotnwjccwk3i77x7nz53bge.jpg",
  GORA:
    "https://valki.wiki/onewebmedia/GORAbafybeifx34524x5xwzlifpydezice7q4ncm3vpbeuyyq4ec25i35llo6im.jpg",
  DKDEFI:
    "https://valki.wiki/onewebmedia/DKDEFIbafybeidrme5so552o73wgnolhsuckz6lua26ype5zubbii5ayxbpurpk7e.jpg",
  IQVAULT:
    "https://valki.wiki/onewebmedia/IQVAULTbafybeidpphachqbmlcb3y6uazwlfbgrstydk5g6yuoifixgv6clc62o56u.jpg",
  IQYIELD:
    "https://valki.wiki/onewebmedia/IQYIELDbafybeidx6nfvuh5bn46kxeexwkmky37bcmjb7bc3spa2sbnpwtgyjb735i.jpg",
  NOIR:
    "https://valki.wiki/onewebmedia/NOIRbafkreidalmmymubixomphnmzjxykrycygvo5z75h6hsjpchfy2yphzld6m.jpg",
  ASTRALFXIQ:
    "https://valki.wiki/onewebmedia/ASTRALFXIQbafybeidpzyc7btvmeeyz4d4xbeydm2rdwuj4avdvehc745qkpqehufhfre.jpg",
};

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

async function main() {
  const args = parseArgs();
  const dryRun = isTruthy(args.dryRun);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const mappings = Object.entries(DESKTOP_IMAGE_OVERRIDES).map(([ticker, desktopImageUrl]) => ({
    ticker: ticker.toUpperCase(),
    desktopImageUrl,
  }));

  console.log("[importDesktopImageOverrides] script start");
  console.log(`[importDesktopImageOverrides] total mappings=${mappings.length}`);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let upsertedCount = 0;
  let failedCount = 0;

  try {
    for (const { ticker, desktopImageUrl } of mappings) {
      console.log(`[importDesktopImageOverrides] processing ticker=${ticker}`);

      try {
        if (!dryRun) {
          await client.query(
            `INSERT INTO "agents" ("ticker", "desktop_image_url")
             VALUES ($1, $2)
             ON CONFLICT ("ticker")
             DO UPDATE SET "desktop_image_url" = EXCLUDED."desktop_image_url", "updated_at" = NOW()`,
            [ticker, desktopImageUrl]
          );
        }

        upsertedCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error(
          `[importDesktopImageOverrides] failed ticker=${ticker} message=${error?.message || error}`
        );
      }
    }
  } finally {
    await client.end();
  }

  console.log(`[importDesktopImageOverrides] upserted count=${upsertedCount}`);
  console.log(`[importDesktopImageOverrides] failed count=${failedCount}`);
  console.log(
    `[importDesktopImageOverrides] final summary total=${mappings.length} upserted=${upsertedCount} failed=${failedCount} dryRun=${dryRun}`
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("importDesktopImageOverrides failed:", error?.message || error);
  process.exitCode = 1;
});
