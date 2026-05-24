#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_ENV="${ROOT_DIR}/.local/supabase-local.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

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
    printf "  %-24s %-12s %s\n" "$name" "missing" "$ports"
  else
    printf "  %-24s %-12s %s\n" "$name" "$state" "$ports"
  fi
}

service_health() {
  local name="$1"
  local url="$2"
  shift 2

  if curl -fsS "$url" "$@" >/dev/null 2>&1; then
    printf "  %-24s ok\n" "$name"
  else
    printf "  %-24s not responding\n" "$name"
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

echo
echo "Health:"
service_health "Collector" "http://127.0.0.1:3005/health"
service_health "Ollama" "http://127.0.0.1:${OLLAMA_PORT:-11435}/api/tags"
service_health "Qdrant" "http://127.0.0.1:6333/collections" -H "api-key: ${QDRANT_API_KEY:-}"
service_health "Supabase REST" "http://127.0.0.1:8000/rest/v1/" -H "apikey: ${ANON_KEY:-}"

echo
echo "URLs:"
printf "  %-24s %s\n" "Collector" "http://127.0.0.1:3005"
printf "  %-24s %s\n" "Supabase Studio" "${SUPABASE_STUDIO_URL:-http://127.0.0.1:3000}"
printf "  %-24s %s\n" "Supabase API" "${SUPABASE_PUBLIC_URL:-http://127.0.0.1:8000}"
printf "  %-24s %s\n" "Qdrant" "http://127.0.0.1:6333"
printf "  %-24s %s\n" "Ollama" "http://127.0.0.1:${OLLAMA_PORT:-11435}"

if [ -n "${DASHBOARD_USERNAME:-}" ] && [ -n "${DASHBOARD_PASSWORD:-}" ]; then
  echo
  echo "Supabase Studio login:"
  printf "  %-24s %s\n" "username" "$DASHBOARD_USERNAME"
  printf "  %-24s %s\n" "password" "$DASHBOARD_PASSWORD"
fi
