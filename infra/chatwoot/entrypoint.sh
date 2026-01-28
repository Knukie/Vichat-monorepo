#!/bin/sh
set -eu

log() {
  echo "[entrypoint] $*"
}

role="${ROLE:-web}"

if [ "$role" = "web" ]; then
  log "Running Chatwoot db:chatwoot_prepare..."
  if ! bundle exec rails db:chatwoot_prepare; then
    log "db:chatwoot_prepare failed. Exiting."
    exit 1
  fi
else
  log "ROLE=$role - skipping migrations."
fi

# Railway verwacht dat je luistert op $PORT
PORT_TO_USE="${PORT:-3000}"

# Als er een command is meegegeven (CMD/Start Command), voer dat uit.
# Anders: start default web/worker.
if [ "$#" -gt 0 ]; then
  log "Starting (custom): $*"
  exec "$@"
fi

if [ "$role" = "worker" ]; then
  log "Starting Sidekiq..."
  exec bundle exec sidekiq -C config/sidekiq.yml
else
  log "Starting Puma on 0.0.0.0:$PORT_TO_USE..."
  exec bundle exec puma -C config/puma.rb -p "$PORT_TO_USE" -b 0.0.0.0
fi
