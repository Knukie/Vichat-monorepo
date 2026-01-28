#!/bin/sh
set -e

echo "[entrypoint] Running Chatwoot db:chatwoot_prepare..."
if ! bundle exec rails db:chatwoot_prepare; then
  echo "[entrypoint] db:chatwoot_prepare failed (continuing; likely already applied)."
fi

echo "[entrypoint] Starting: $*"
exec "$@"
