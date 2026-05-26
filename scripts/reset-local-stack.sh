#!/usr/bin/env bash
# Guarded reset for generated local runtime data.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="${ROOT_DIR}/.local"
RESET_MODE="${RESET_MODE:-data}"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

usage() {
  cat <<'EOF'
Refusing to reset local data without confirmation.

This command deletes generated local runtime data. It never deletes source files.

Usage:
  RESET_LOCAL_DATA=true npm run reset:local
  RESET_LOCAL_DATA=true RESET_MODE=all npm run reset:local

Modes:
  data  Stop the stack and remove Supabase runtime data + Qdrant memory.
        Keeps .local/ollama models and generated .env secrets.

  all   Stop the stack and remove all generated local stack data, including
        Ollama models, generated Supabase files, Qdrant data, Activepieces
        data, .env, and .local/supabase-local.env.
EOF
}

if [ "${RESET_LOCAL_DATA:-}" != "true" ]; then
  usage
  exit 1
fi

if [ "$RESET_MODE" != "data" ] && [ "$RESET_MODE" != "all" ]; then
  echo "Invalid RESET_MODE: ${RESET_MODE}" >&2
  echo "Expected RESET_MODE=data or RESET_MODE=all" >&2
  exit 1
fi

remove_path() {
  local path="$1"

  if [ -e "$path" ]; then
    echo "Removing ${path#"$ROOT_DIR/"}"
    rm -rf "$path"
  fi
}

echo "Stopping local stack..."
"${ROOT_DIR}/scripts/stop-local-stack.sh" >/dev/null 2>&1 || true

echo "Removing stopped reduOS containers..."
for name in redu-os-collector redu-os-qdrant redu-os-ollama redu-os-activepieces redu-os-activepieces-postgres redu-os-activepieces-redis redu-os-uptime-kuma redu-os-uptime-kuma-mariadb redu-os-umami redu-os-umami-postgres redu-os-glitchtip redu-os-glitchtip-postgres redu-os-glitchtip-redis redu-os-listmonk redu-os-listmonk-postgres redu-os-langfuse-web redu-os-langfuse-worker redu-os-langfuse-postgres redu-os-langfuse-clickhouse redu-os-langfuse-minio redu-os-langfuse-redis zammad_zammad-nginx_1 zammad_zammad-railsserver_1 zammad_zammad-scheduler_1 zammad_zammad-websocket_1 zammad_zammad-postgresql_1 zammad_zammad-redis_1 zammad_zammad-memcached_1; do
  podman rm -f "$name" >/dev/null 2>&1 || true
done

echo "Removing stopped Supabase containers..."
if command -v podman >/dev/null 2>&1; then
  while IFS= read -r name; do
    if [ -n "$name" ]; then
      podman rm -f "$name" >/dev/null 2>&1 || true
    fi
  done < <(podman ps -a --format '{{.Names}}' | grep '^supabase-' || true)
fi

case "$RESET_MODE" in
  data)
    remove_path "${LOCAL_DIR}/qdrant"
    remove_path "${LOCAL_DIR}/supabase/volumes/db/data"
    remove_path "${LOCAL_DIR}/supabase/volumes/storage"
    remove_path "${LOCAL_DIR}/supabase/volumes/functions"
    remove_path "${LOCAL_DIR}/activepieces/postgres"
    remove_path "${LOCAL_DIR}/activepieces/redis"
    remove_path "${LOCAL_DIR}/glitchtip/postgres"
    remove_path "${LOCAL_DIR}/glitchtip/redis"
    remove_path "${LOCAL_DIR}/glitchtip/uploads"
    remove_path "${LOCAL_DIR}/listmonk/postgres"
    remove_path "${LOCAL_DIR}/langfuse/postgres"
    remove_path "${LOCAL_DIR}/langfuse/clickhouse"
    remove_path "${LOCAL_DIR}/langfuse/clickhouse-logs"
    remove_path "${LOCAL_DIR}/langfuse/minio"
    remove_path "${LOCAL_DIR}/langfuse/redis"
    remove_path "${LOCAL_DIR}/listmonk/uploads"
    remove_path "${LOCAL_DIR}/listmonk/.installed"
    remove_path "${LOCAL_DIR}/listmonk/list.env"
    remove_path "${LOCAL_DIR}/zammad/postgresql-data"
    remove_path "${LOCAL_DIR}/zammad/redis-data"
    remove_path "${LOCAL_DIR}/zammad/memcached-data"
    remove_path "${LOCAL_DIR}/zammad/elasticsearch-data"
    ;;
  all)
    remove_path "${ROOT_DIR}/.env"
    remove_path "${LOCAL_DIR}/supabase-local.env"
    remove_path "${LOCAL_DIR}/qdrant"
    remove_path "${LOCAL_DIR}/ollama"
    remove_path "${LOCAL_DIR}/activepieces"
    remove_path "${LOCAL_DIR}/uptime-kuma"
    remove_path "${LOCAL_DIR}/umami"
    remove_path "${LOCAL_DIR}/glitchtip"
    remove_path "${LOCAL_DIR}/listmonk"
    remove_path "${LOCAL_DIR}/langfuse"
    remove_path "${LOCAL_DIR}/zammad"
    remove_path "${LOCAL_DIR}/supabase"
    remove_path "${LOCAL_DIR}/supabase-src"
    ;;
esac

echo
echo "Local reset complete (${RESET_MODE})."
echo "Run npm run stack:up to recreate the stack."
