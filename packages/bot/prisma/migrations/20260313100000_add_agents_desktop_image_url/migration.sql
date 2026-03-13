ALTER TABLE IF EXISTS "agents"
ADD COLUMN IF NOT EXISTS "desktop_image_url" TEXT;

DO $$
BEGIN
  IF to_regclass('public.agents') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "agents_ticker_idx"
      ON "agents" (UPPER("ticker"));
  END IF;
END
$$;
