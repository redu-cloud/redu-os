#!/usr/bin/env bash
# Print logs for local stack containers, optionally following with FOLLOW=true.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

TARGET="${1:-all}"
TAIL="${TAIL:-150}"
FOLLOW="${FOLLOW:-false}"

logs_args=(--tail "$TAIL")
if [ "$FOLLOW" = "true" ] || [ "$FOLLOW" = "1" ]; then
  logs_args=(-f "${logs_args[@]}")
fi

print_logs() {
  local name="$1"

  if ! podman container exists "$name" 2>/dev/null; then
    echo
    echo "==> ${name} is not present"
    return
  fi

  echo
  echo "==> ${name}"
  podman logs "${logs_args[@]}" "$name"
}

case "$TARGET" in
  collector)
    print_logs redu-os-collector
    ;;
  ollama)
    print_logs redu-os-ollama
    ;;
  qdrant)
    print_logs redu-os-qdrant
    ;;
  supabase)
    for name in supabase-kong supabase-studio supabase-db supabase-auth supabase-rest supabase-realtime supabase-storage supabase-meta; do
      print_logs "$name"
    done
    ;;
  activepieces)
    for name in redu-os-activepieces redu-os-activepieces-postgres redu-os-activepieces-redis; do
      print_logs "$name"
    done
    ;;
  uptime)
    for name in redu-os-uptime-kuma redu-os-uptime-kuma-mariadb; do
      print_logs "$name"
    done
    ;;
  umami)
    for name in redu-os-umami redu-os-umami-postgres; do
      print_logs "$name"
    done
    ;;
  glitchtip)
    for name in redu-os-glitchtip redu-os-glitchtip-postgres redu-os-glitchtip-redis; do
      print_logs "$name"
    done
    ;;
  listmonk)
    for name in redu-os-listmonk redu-os-listmonk-postgres; do
      print_logs "$name"
    done
    ;;
  all)
    for name in redu-os-collector redu-os-qdrant redu-os-ollama supabase-kong supabase-studio supabase-db redu-os-activepieces redu-os-uptime-kuma redu-os-umami redu-os-glitchtip redu-os-listmonk; do
      print_logs "$name"
    done
    ;;
  *)
    echo "Unknown log target: ${TARGET}" >&2
    echo "Usage: npm run logs [all|collector|ollama|qdrant|supabase|activepieces|uptime|umami|glitchtip|listmonk]" >&2
    echo "Examples:" >&2
    echo "  npm run logs" >&2
    echo "  npm run logs:collector" >&2
    echo "  FOLLOW=true npm run logs:collector" >&2
    echo "  TAIL=300 npm run logs -- supabase" >&2
    exit 1
    ;;
esac
