#!/bin/sh
echo "[entrypoint] BOOT $(date) ROLE=${ROLE:-web} PORT=${PORT:-unset}"

set -eu
log() { echo "[entrypoint] $*"; }

role="${ROLE:-web}"

extract_host() {
  value="$1"
  if [ -z "$value" ]; then
    echo ""
    return
  fi

  case "$value" in
    *://*) value="${value#*://}" ;;
  esac

  value="${value%%/*}"
  value="${value%%\?*}"
  value="${value%%\#*}"
  value="${value%%:*}"
  echo "$value"
}

effective_host="${HOST:-}"
if [ -z "$effective_host" ] || [ "$effective_host" = "0.0.0.0" ]; then
  if [ -n "${APP_HOST:-}" ]; then
    effective_host="${APP_HOST}"
  elif [ -n "${RAILS_HOST:-}" ]; then
    effective_host="${RAILS_HOST}"
  else
    backend_host="$(extract_host "${BACKEND_URL:-}")"
    frontend_host="$(extract_host "${FRONTEND_URL:-}")"
    if [ -n "$backend_host" ]; then
      effective_host="$backend_host"
    elif [ -n "$frontend_host" ]; then
      effective_host="$frontend_host"
    fi
  fi
fi

if [ -n "$effective_host" ]; then
  export HOST="$effective_host"
fi

log "EFFECTIVE HOST=${HOST:-unset}"

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
