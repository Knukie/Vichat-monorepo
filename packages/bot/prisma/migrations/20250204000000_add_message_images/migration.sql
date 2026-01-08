-- Add optional images column for message uploads.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "images" JSONB;
ALTER TABLE "messages" ALTER COLUMN "images" SET DEFAULT '[]'::jsonb;
