CREATE TABLE IF NOT EXISTS "agent_price_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticker" TEXT NOT NULL,
  "agent_id" TEXT,
  "price_usd" DECIMAL(30, 12) NOT NULL,
  "price_iq" DECIMAL(30, 12),
  "market_cap" DECIMAL(30, 4),
  "liquidity_usd" DECIMAL(30, 4),
  "volume_24h_usd" DECIMAL(30, 4),
  "source" TEXT DEFAULT 'iqai',
  "recorded_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_price_snapshots_ticker_recorded_at_key"
  ON "agent_price_snapshots" ("ticker", "recorded_at");

CREATE INDEX IF NOT EXISTS "agent_price_snapshots_ticker_recorded_at_idx"
  ON "agent_price_snapshots" ("ticker", "recorded_at");

CREATE INDEX IF NOT EXISTS "agent_price_snapshots_recorded_at_idx"
  ON "agent_price_snapshots" ("recorded_at");
