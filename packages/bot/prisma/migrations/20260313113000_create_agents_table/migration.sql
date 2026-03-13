CREATE TABLE IF NOT EXISTS "agents" (
  "id" SERIAL PRIMARY KEY,
  "ticker" TEXT NOT NULL,
  "name" TEXT,
  "desktop_image_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS "agents"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "desktop_image_url" TEXT,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS "agents_ticker_key"
  ON "agents" ("ticker");

CREATE INDEX IF NOT EXISTS "agents_ticker_idx"
  ON "agents" (UPPER("ticker"));
