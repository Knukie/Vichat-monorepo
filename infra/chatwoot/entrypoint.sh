#!/bin/sh


echo "[entrypoint] starting..."
echo "[entrypoint] shell=$(ps -p $$ -o comm= 2>/dev/null || echo sh)"
echo "[entrypoint] ROLE=${ROLE:-web} PORT=${PORT:-<unset>}"


set -eu


log() { echo "[entrypoint] $*"; }


role="${ROLE:-web}"


if [ "$role" = "web" ]; then
log "Running db:chatwoot_prepare..."
bundle exec rails db:chatwoot_prepare
else
log "ROLE=$role - skipping migrations."
fi


PORT_TO_USE="${PORT:-3000}"


if [ "$role" = "worker" ]; then
log "Starting Sidekiq..."
exec bundle exec sidekiq -C config/sidekiq.yml
else
log "Starting Puma on 0.0.0.0:$PORT_TO_USE..."
exec bundle exec puma -C config/puma.rb -p "$PORT_TO_USE" -b 0.0.0.0
fi
