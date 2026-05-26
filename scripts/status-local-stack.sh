#!/usr/bin/env bash
# Print local stack container status, health checks, URLs, and local credentials.
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_ENV="${ROOT_DIR}/.local/supabase-local.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

if [ -f "$SUPABASE_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
  set +a
fi

container_status() {
  local name="$1"
  local ports="${2:-}"
  local state

  state="$(podman inspect -f '{{.State.Status}}' "$name" 2>/dev/null || true)"

  if [ -z "$state" ]; then
    printf "  %-32s %-12s %s\n" "$name" "missing" "$ports"
  else
    printf "  %-32s %-12s %s\n" "$name" "$state" "$ports"
  fi
}

service_health() {
  local name="$1"
  local url="$2"
  shift 2

  if curl -fsS "$url" "$@" >/dev/null 2>&1; then
    printf "  %-32s ok\n" "$name"
  else
    printf "  %-32s not responding\n" "$name"
  fi
}

echo "reduOS local status"
echo

echo "Containers:"
container_status redu-os-collector "3005"
container_status redu-os-qdrant "6333, 6334"
container_status redu-os-ollama "${OLLAMA_PORT:-11435}"
container_status supabase-db "${SUPABASE_DB_PORT:-5432}"
container_status supabase-kong "${SUPABASE_KONG_HTTP_PORT:-8000}, ${SUPABASE_KONG_HTTPS_PORT:-8443}"
container_status supabase-studio "${SUPABASE_STUDIO_PORT:-3000}"

if podman container exists redu-os-activepieces 2>/dev/null \
  || podman container exists redu-os-activepieces-postgres 2>/dev/null \
  || podman container exists redu-os-activepieces-redis 2>/dev/null \
  || podman container exists redu-os-uptime-kuma 2>/dev/null \
  || podman container exists redu-os-uptime-kuma-mariadb 2>/dev/null \
  || podman container exists redu-os-umami 2>/dev/null \
  || podman container exists redu-os-umami-postgres 2>/dev/null \
  || podman container exists redu-os-glitchtip 2>/dev/null \
  || podman container exists redu-os-glitchtip-postgres 2>/dev/null \
  || podman container exists redu-os-glitchtip-redis 2>/dev/null \
  || podman container exists redu-os-listmonk 2>/dev/null \
  || podman container exists redu-os-listmonk-postgres 2>/dev/null \
  || podman container exists zammad_zammad-railsserver_1 2>/dev/null \
  || podman container exists zammad_zammad-nginx_1 2>/dev/null \
  || podman container exists redu-os-langfuse-web 2>/dev/null; then
  echo
  echo "Optional modules:"
  if podman container exists redu-os-activepieces 2>/dev/null \
    || podman container exists redu-os-activepieces-postgres 2>/dev/null \
    || podman container exists redu-os-activepieces-redis 2>/dev/null; then
    container_status redu-os-activepieces "${ACTIVEPIECES_PORT:-8080}"
    container_status redu-os-activepieces-postgres ""
    container_status redu-os-activepieces-redis ""
  fi
  if podman container exists redu-os-uptime-kuma 2>/dev/null \
    || podman container exists redu-os-uptime-kuma-mariadb 2>/dev/null; then
    container_status redu-os-uptime-kuma "${UPTIME_KUMA_PORT:-3001}"
    container_status redu-os-uptime-kuma-mariadb ""
  fi
  if podman container exists redu-os-umami 2>/dev/null \
    || podman container exists redu-os-umami-postgres 2>/dev/null; then
    container_status redu-os-umami "${UMAMI_PORT:-3002}"
    container_status redu-os-umami-postgres ""
  fi
  if podman container exists redu-os-glitchtip 2>/dev/null \
    || podman container exists redu-os-glitchtip-postgres 2>/dev/null \
    || podman container exists redu-os-glitchtip-redis 2>/dev/null; then
    container_status redu-os-glitchtip "${GLITCHTIP_PORT:-8001}"
    container_status redu-os-glitchtip-postgres ""
    container_status redu-os-glitchtip-redis ""
  fi
  if podman container exists redu-os-listmonk 2>/dev/null \
    || podman container exists redu-os-listmonk-postgres 2>/dev/null; then
    container_status redu-os-listmonk "${LISTMONK_PORT:-9000}"
    container_status redu-os-listmonk-postgres ""
  fi
  if podman container exists zammad_zammad-railsserver_1 2>/dev/null \
    || podman container exists zammad_zammad-nginx_1 2>/dev/null; then
    container_status zammad_zammad-nginx_1 "${ZAMMAD_PORT:-8081}"
    container_status zammad_zammad-railsserver_1 ""
    container_status zammad_zammad-scheduler_1 ""
    container_status zammad_zammad-websocket_1 ""
    container_status zammad_zammad-postgresql_1 ""
    container_status zammad_zammad-redis_1 ""
    container_status zammad_zammad-memcached_1 ""
  fi
  if podman container exists redu-os-langfuse-web 2>/dev/null; then
    container_status redu-os-langfuse-web "${LANGFUSE_PORT:-3007}"
    container_status redu-os-langfuse-worker "${LANGFUSE_WORKER_PORT:-3030}"
    container_status redu-os-langfuse-postgres ""
    container_status redu-os-langfuse-clickhouse "${LANGFUSE_CLICKHOUSE_HTTP_PORT:-8123}, ${LANGFUSE_CLICKHOUSE_NATIVE_PORT:-9001}"
    container_status redu-os-langfuse-minio "${LANGFUSE_MINIO_PORT:-9090}"
    container_status redu-os-langfuse-redis ""
  fi
fi

echo
echo "Health:"
service_health "Collector" "http://127.0.0.1:3005/health"
service_health "Ollama" "http://127.0.0.1:${OLLAMA_PORT:-11435}/api/tags"
service_health "Qdrant" "http://127.0.0.1:6333/collections" -H "api-key: ${QDRANT_API_KEY:-}"
service_health "Supabase REST" "http://127.0.0.1:8000/rest/v1/" -H "apikey: ${ANON_KEY:-}"

if podman container exists redu-os-activepieces 2>/dev/null; then
  service_health "Activepieces" "http://127.0.0.1:${ACTIVEPIECES_PORT:-8080}"
fi
if podman container exists redu-os-uptime-kuma 2>/dev/null; then
  service_health "Uptime Kuma" "http://127.0.0.1:${UPTIME_KUMA_PORT:-3001}"
fi
if podman container exists redu-os-umami 2>/dev/null; then
  service_health "Umami" "http://127.0.0.1:${UMAMI_PORT:-3002}"
fi
if podman container exists redu-os-glitchtip 2>/dev/null; then
  service_health "GlitchTip" "http://127.0.0.1:${GLITCHTIP_PORT:-8001}"
fi
if podman container exists redu-os-listmonk 2>/dev/null; then
  service_health "Listmonk" "http://127.0.0.1:${LISTMONK_PORT:-9000}"
fi
if podman container exists zammad_zammad-nginx_1 2>/dev/null; then
  service_health "Zammad" "${ZAMMAD_URL:-http://127.0.0.1:${ZAMMAD_PORT:-8081}}"
fi
if podman container exists redu-os-langfuse-web 2>/dev/null; then
  service_health "Langfuse" "${LANGFUSE_URL:-http://127.0.0.1:${LANGFUSE_PORT:-3007}}"
fi

echo
echo "URLs:"
printf "  %-32s %s\n" "Collector" "http://127.0.0.1:3005"
printf "  %-32s %s\n" "Dashboard" "http://127.0.0.1:${DASHBOARD_PORT:-3006}"
printf "  %-32s %s\n" "Supabase Studio" "${SUPABASE_STUDIO_URL:-http://127.0.0.1:3000}"
printf "  %-32s %s\n" "Supabase API" "${SUPABASE_PUBLIC_URL:-http://127.0.0.1:8000}"
printf "  %-32s %s\n" "Qdrant" "http://127.0.0.1:6333"
printf "  %-32s %s\n" "Ollama" "http://127.0.0.1:${OLLAMA_PORT:-11435}"
printf "  %-32s %s\n" "Activepieces" "${AP_FRONTEND_URL:-http://127.0.0.1:${ACTIVEPIECES_PORT:-8080}}"
printf "  %-32s %s\n" "Uptime Kuma" "${UPTIME_KUMA_URL:-http://127.0.0.1:${UPTIME_KUMA_PORT:-3001}}"
printf "  %-32s %s\n" "Umami" "${UMAMI_URL:-http://127.0.0.1:${UMAMI_PORT:-3002}}"
printf "  %-32s %s\n" "GlitchTip" "${GLITCHTIP_URL:-http://127.0.0.1:${GLITCHTIP_PORT:-8001}}"
printf "  %-32s %s\n" "Listmonk" "${LISTMONK_URL:-http://127.0.0.1:${LISTMONK_PORT:-9000}}"
printf "  %-32s %s\n" "Zammad" "${ZAMMAD_URL:-http://127.0.0.1:${ZAMMAD_PORT:-8081}}"
printf "  %-32s %s\n" "Langfuse" "${LANGFUSE_URL:-http://127.0.0.1:${LANGFUSE_PORT:-3007}}"

if [ -n "${DASHBOARD_AUTH_EMAIL:-}" ] && [ -n "${DASHBOARD_AUTH_PASSWORD:-}" ]; then
  echo
  echo "Dashboard login:"
  printf "  %-32s %s\n" "email" "$DASHBOARD_AUTH_EMAIL"
  printf "  %-32s %s\n" "password" "$DASHBOARD_AUTH_PASSWORD"
fi

if [ -n "${DASHBOARD_USERNAME:-}" ] && [ -n "${DASHBOARD_PASSWORD:-}" ]; then
  echo
  echo "Supabase Studio login:"
  printf "  %-32s %s\n" "username" "$DASHBOARD_USERNAME"
  printf "  %-32s %s\n" "password" "$DASHBOARD_PASSWORD"
fi

if [ -n "${UPTIME_KUMA_ADMIN_USERNAME:-}" ] && [ -n "${UPTIME_KUMA_ADMIN_PASSWORD:-}" ]; then
  echo
  echo "Uptime Kuma login:"
  printf "  %-32s %s\n" "username" "$UPTIME_KUMA_ADMIN_USERNAME"
  printf "  %-32s %s\n" "password" "$UPTIME_KUMA_ADMIN_PASSWORD"
fi

if [ -n "${UMAMI_ADMIN_USERNAME:-}" ] && [ -n "${UMAMI_ADMIN_PASSWORD:-}" ]; then
  echo
  echo "Umami login:"
  printf "  %-32s %s\n" "username" "$UMAMI_ADMIN_USERNAME"
  printf "  %-32s %s\n" "password" "$UMAMI_ADMIN_PASSWORD"
fi

if [ -n "${GLITCHTIP_ADMIN_EMAIL:-}" ] && [ -n "${GLITCHTIP_ADMIN_PASSWORD:-}" ]; then
  echo
  echo "GlitchTip login:"
  printf "  %-32s %s\n" "email" "$GLITCHTIP_ADMIN_EMAIL"
  printf "  %-32s %s\n" "password" "$GLITCHTIP_ADMIN_PASSWORD"
fi

if [ -n "${LISTMONK_ADMIN_USERNAME:-}" ] && [ -n "${LISTMONK_ADMIN_PASSWORD:-}" ]; then
  echo
  echo "Listmonk login:"
  printf "  %-32s %s\n" "username" "$LISTMONK_ADMIN_USERNAME"
  printf "  %-32s %s\n" "password" "$LISTMONK_ADMIN_PASSWORD"
fi

if [ -n "${ZAMMAD_ADMIN_EMAIL:-}" ] && [ -n "${ZAMMAD_ADMIN_PASSWORD:-}" ]; then
  echo
  echo "Zammad login:"
  printf "  %-32s %s\n" "email" "$ZAMMAD_ADMIN_EMAIL"
  printf "  %-32s %s\n" "password" "$ZAMMAD_ADMIN_PASSWORD"
fi

if [ -n "${LANGFUSE_ADMIN_EMAIL:-}" ] && [ -n "${LANGFUSE_ADMIN_PASSWORD:-}" ]; then
  echo
  echo "Langfuse login:"
  printf "  %-32s %s\n" "email" "$LANGFUSE_ADMIN_EMAIL"
  printf "  %-32s %s\n" "password" "$LANGFUSE_ADMIN_PASSWORD"
  printf "  %-32s %s\n" "public key" "${LANGFUSE_PUBLIC_KEY:-}"
fi
