#!/bin/sh
set -eu

log() {
  echo "[entrypoint] $*"
}

# Railway expects the app to listen on $PORT.
# Provide a safe fallback for environments that don't inject it.
export PORT="${PORT:-3000}"

log "BOOT $(date) ROLE=${ROLE:-web} PORT=${PORT}"

mkdir -p /app/tmp/pids /app/tmp/cache /app/tmp/sockets /app/log

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

# Only override HOST if it's empty or the default bind-all value.
if [ -z "${HOST:-}" ] || [ "${HOST:-}" = "0.0.0.0" ]; then
  if [ -n "$effective_host" ]; then
    export HOST="$effective_host"
  fi
fi

log "EFFECTIVE HOST=${HOST:-unset}"

role="${ROLE:-web}"

if [ "$role" = "web" ]; then
  log "Running db:chatwoot_prepare..."
  bundle exec rails db:chatwoot_prepare
fi

if [ "$role" = "worker" ]; then
  log "Starting Sidekiq..."
  exec bundle exec sidekiq -C config/sidekiq.yml
fi

log "Starting main process: $*"
exec "$@"
