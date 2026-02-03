#!/bin/sh
set -eu

log() { echo "[entrypoint] $*"; }

log "BOOT $(date) ROLE=${ROLE:-web} PORT=${PORT:-unset} RAILS_ENV=${RAILS_ENV:-unset}"

mkdir -p /app/tmp/pids /app/tmp/cache /app/tmp/sockets /app/log

extract_host() {
  value="$1"
  [ -z "$value" ] && echo "" && return
  case "$value" in
    *://*) value="${value#*://}" ;;
  esac
  value="${value%%/*}"
  value="${value%%\?*}"
  value="${value%%\#*}"
  value="${value%%:*}"
  echo "$value"
}

effective_host=""
if [ -n "${APP_HOST:-}" ]; then
  effective_host="$APP_HOST"
elif [ -n "${RAILS_HOST:-}" ]; then
  effective_host="$RAILS_HOST"
else
  backend_host="$(extract_host "${BACKEND_URL:-}")"
  frontend_host="$(extract_host "${FRONTEND_URL:-}")"
  if [ -n "$backend_host" ]; then
    effective_host="$backend_host"
  elif [ -n "$frontend_host" ]; then
    effective_host="$frontend_host"
  fi
fi

if [ -z "${HOST:-}" ] || [ "${HOST:-}" = "0.0.0.0" ]; then
  [ -n "$effective_host" ] && export HOST="$effective_host"
fi

log "EFFECTIVE HOST=${HOST:-unset}"

role="${ROLE:-web}"

if [ "$role" = "web" ]; then
  log "Running db:chatwoot_prepare..."
  # retry up to 5 times with 3s sleep
  i=1
  while :; do
    if bundle exec rails db:chatwoot_prepare; then
      break
    fi
    if [ "$i" -ge 5 ]; then
      log "db:chatwoot_prepare failed after $i attempts"
      exit 1
    fi
    log "db:chatwoot_prepare failed (attempt $i), retrying..."
    i=$((i+1))
    sleep 3
  done
fi

if [ "$role" = "worker" ]; then
  log "Starting Sidekiq..."
  exec bundle exec sidekiq -C config/sidekiq.yml
fi

log "Starting main process: $*"
exec "$@"
