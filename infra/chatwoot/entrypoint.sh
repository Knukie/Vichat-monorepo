#!/bin/sh

echo "[entrypoint] Running Chatwoot db:chatwoot_prepare..."

bundle exec rails db:chatwoot_prepare || echo "[entrypoint] prepare already applied or skipped"

echo "[entrypoint] Starting: $@"
exec "$@"
