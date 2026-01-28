#!/bin/sh

echo "[entrypoint] BOOT $(date)"
echo "[entrypoint] ROLE=${ROLE:-web} PORT=${PORT:-unset}"
echo "[entrypoint] starting..."
echo "[entrypoint] shell=$(ps -p $$ -o comm= 2>/dev/null || echo sh)"

set -eu

log() { echo "[entrypoint] $*"; }

role="${ROLE:-web}"

# Run migrations/prepare only on web
if [ "$role" = "web" ]; then
  log "Running db:chatwoot_prepare..."
  bundle exec rails db:chatwoot_prepare
else
  log "ROLE=$role - skipping migrations."
fi

# Worker ignores CMD and starts Sidekiq
if [ "$role" = "worker" ]; then
  log "Starting Sidekiq..."
  exec bundle exec sidekiq -C config/sidekiq.yml
fi

# Web: start the main command (from Docker CMD / Railway start command)
log "Starting main process: $*"
exec "$@"
