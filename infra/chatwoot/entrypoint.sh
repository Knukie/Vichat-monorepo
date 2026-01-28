#!/bin/sh
echo "[entrypoint] BOOT $(date) ROLE=${ROLE:-web} PORT=${PORT:-unset}"

set -eu
log() { echo "[entrypoint] $*"; }

role="${ROLE:-web}"

if [ "$role" = "web" ]; then
  log "Running db:chatwoot_prepare..."
  bundle exec rails db:chatwoot_prepare
else
  log "ROLE=$role - skipping migrations."
fi

if [ "$role" = "worker" ]; then
  log "Starting Sidekiq..."
  exec bundle exec sidekiq -C config/sidekiq.yml
fi

log "Starting main process: $*"
exec "$@"
