#!/usr/bin/env bash

set -euo pipefail

log() {
  echo "[entrypoint] $*"
}

role="${ROLE:-web}"

if [[ "${role}" == "web" ]]; then
  log "Running Chatwoot db:chatwoot_prepare..."
  if ! bundle exec rails db:chatwoot_prepare; then
    log "db:chatwoot_prepare failed. Exiting."
    exit 1
  fi
else
  log "ROLE=${role} - skipping migrations."
fi

log "Starting: $*"
exec "$@"
