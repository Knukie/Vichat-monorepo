-- Expand users, conversations, and messages with agent/customer metadata.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS "display_name" TEXT,
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'offline';

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "customer_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "assigned_agent_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "department_id" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "last_message_at" TIMESTAMPTZ;

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "sender_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'text';

ALTER TABLE "messages"
  ALTER COLUMN "role" SET DEFAULT 'customer';

-- Indices
CREATE INDEX IF NOT EXISTS "conversations_customer_id_idx"
  ON "conversations" ("customer_id");

CREATE INDEX IF NOT EXISTS "conversations_assigned_agent_id_idx"
  ON "conversations" ("assigned_agent_id");

CREATE INDEX IF NOT EXISTS "messages_sender_id_idx"
  ON "messages" ("sender_id");

-- Foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'conversations_customer_id_fkey'
          AND table_name = 'conversations'
    ) THEN
        ALTER TABLE "conversations"
        ADD CONSTRAINT "conversations_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'conversations_assigned_agent_id_fkey'
          AND table_name = 'conversations'
    ) THEN
        ALTER TABLE "conversations"
        ADD CONSTRAINT "conversations_assigned_agent_id_fkey"
        FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'messages_sender_id_fkey'
          AND table_name = 'messages'
    ) THEN
        ALTER TABLE "messages"
        ADD CONSTRAINT "messages_sender_id_fkey"
        FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
END $$;
