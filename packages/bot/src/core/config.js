import "dotenv/config";

const env = process.env;

export const config = {
  PORT: env.PORT ?? "3000",
  NODE_ENV: env.NODE_ENV ?? "production",
  CORS_ORIGINS:
    env.CORS_ORIGINS ?? "https://valki.wiki,https://www.valki.wiki,https://auth.valki.wiki",
  JSON_BODY_LIMIT: env.JSON_BODY_LIMIT ?? "20mb",
  MAX_INPUT_CHARS: env.MAX_INPUT_CHARS ?? "800",
  MAX_OUTPUT_TOKENS: env.MAX_OUTPUT_TOKENS ?? "800",
  DATABASE_URL: env.DATABASE_URL,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  VALKI_PROMPT_ID: env.VALKI_PROMPT_ID,
  DISCORD_TOKEN: env.DISCORD_TOKEN,
  CHANNEL_IDS: env.CHANNEL_IDS ?? "",
  DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: env.DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI: env.DISCORD_REDIRECT_URI,
  GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
  AUTH_TOKEN_SECRET: env.AUTH_TOKEN_SECRET,
  UPLOAD_DIR: env.UPLOAD_DIR,
  UPLOAD_BASE_URL: env.UPLOAD_BASE_URL,
  PUBLIC_UPLOAD_BASE_URL: env.PUBLIC_UPLOAD_BASE_URL,
  S3_ENDPOINT: env.S3_ENDPOINT,
  S3_REGION: env.S3_REGION,
  S3_BUCKET: env.S3_BUCKET,
  S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY
};

export const corsOrigins = config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
export const allowedChannels = new Set(
  config.CHANNEL_IDS.split(",").map((s) => s.trim()).filter(Boolean)
);

export const MAX_INPUT =
  Number.isFinite(Number(config.MAX_INPUT_CHARS)) ? Number(config.MAX_INPUT_CHARS) : 800;
export const MAX_OUTPUT =
  Number.isFinite(Number(config.MAX_OUTPUT_TOKENS)) ? Number(config.MAX_OUTPUT_TOKENS) : 800;

function requireEnvVars(names) {
  const missing = names.filter((name) => !config[name]);
  if (!missing.length) return;
  console.error("❌ Missing required environment variables:");
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}

export function ensureSharedEnv() {
  requireEnvVars(["DATABASE_URL", "OPENAI_API_KEY", "VALKI_PROMPT_ID", "AUTH_TOKEN_SECRET"]);
}

export function ensureApiEnv() {
  ensureSharedEnv();
  requireEnvVars([
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_REDIRECT_URI",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI"
  ]);
}
