ALTER TABLE IF EXISTS "agents"
  ADD COLUMN IF NOT EXISTS "desktop_image_url" TEXT;

CREATE INDEX IF NOT EXISTS "agents_ticker_idx"
  ON "agents" (UPPER("ticker"));
