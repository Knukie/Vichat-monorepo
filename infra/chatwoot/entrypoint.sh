#!/bin/sh
echo "[entrypoint] BOOT $(date) ROLE=${ROLE:-web} PORT=${PORT:-unset}"

set -eu
log() { echo "[entrypoint] $*"; }

role="${ROLE:-web}"

if [ -z "${HOST:-}" ] || [ "${HOST:-}" = "0.0.0.0" ]; then
  if [ -n "${APP_HOST:-}" ]; then
    export HOST="$APP_HOST"
  fi
fi

log "HOST=${HOST:-unset}"

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
