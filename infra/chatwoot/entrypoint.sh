#!/bin/sh
echo "[entrypoint] BOOT $(date) ROLE=${ROLE:-web} PORT=${PORT:-unset}"

set -eu
log() { echo "[entrypoint] $*"; }
mask_value() {
  value="$1"
  if [ -z "$value" ]; then
    echo "unset"
    return
  fi

  length="$(printf "%s" "$value" | wc -c | tr -d ' ')"
  if [ "$length" -le 8 ]; then
    echo "***"
    return
  fi

  prefix="$(printf "%s" "$value" | cut -c 1-4)"
  suffix="$(printf "%s" "$value" | cut -c $(("$length" - 3))-"$length")"
  echo "${prefix}***${suffix}"
}

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

log "EFFECTIVE HOST=${HOST:-unset} RAILS_HOST=${RAILS_HOST:-unset} APP_HOST=${APP_HOST:-unset} FRONTEND_URL=${FRONTEND_URL:-unset} BACKEND_URL=${BACKEND_URL:-unset}"
log "DATABASE_URL=$(mask_value "${DATABASE_URL:-}") SECRET_KEY_BASE=$(mask_value "${SECRET_KEY_BASE:-}")"

if [ "${DEBUG_URI:-}" = "1" ]; then
  log "DEBUG_URI enabled - increasing Ruby/Rails verbosity."
  export RAILS_LOG_LEVEL="${RAILS_LOG_LEVEL:-debug}"
  export RUBYOPT="${RUBYOPT:-} -W2 -d"
fi

puma_bind="${PUMA_BIND:-}"
if [ -z "$puma_bind" ] || [ "$puma_bind" = "0.0.0.0" ] || [ "$puma_bind" = "http://0.0.0.0" ]; then
  export PUMA_BIND="tcp://0.0.0.0:${PORT:-3000}"
else
  case "$puma_bind" in
    http://0.0.0.0*)
      export PUMA_BIND="tcp://0.0.0.0:${PORT:-3000}"
      ;;
  esac
fi
log "EFFECTIVE PUMA_BIND=${PUMA_BIND:-unset}"

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
