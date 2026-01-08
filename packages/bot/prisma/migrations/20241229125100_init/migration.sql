-- Create base tables used by the application.
-- The statements are written to be safe to re-run if the tables already exist.

CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "conversations" (
    "id" TEXT PRIMARY KEY,
    "summary" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "user_id" INTEGER
);

CREATE TABLE IF NOT EXISTS "messages" (
    "id" SERIAL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ
);

-- Indices
CREATE UNIQUE INDEX IF NOT EXISTS "users_provider_provider_user_id_key"
  ON "users" ("provider", "provider_user_id");

CREATE INDEX IF NOT EXISTS "conversations_user_id_idx"
  ON "conversations" ("user_id");

CREATE INDEX IF NOT EXISTS "messages_conversation_id_deleted_at_idx"
  ON "messages" ("conversation_id", "deleted_at");

-- Foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'conversations_user_id_fkey'
          AND table_name = 'conversations'
    ) THEN
        ALTER TABLE "conversations"
        ADD CONSTRAINT "conversations_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'messages_conversation_id_fkey'
          AND table_name = 'messages'
    ) THEN
        ALTER TABLE "messages"
        ADD CONSTRAINT "messages_conversation_id_fkey"
        FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;
    END IF;
END $$;
