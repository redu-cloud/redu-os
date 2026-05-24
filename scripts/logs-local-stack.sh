#!/usr/bin/env bash
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
  all)
    for name in redu-os-collector redu-os-qdrant redu-os-ollama supabase-kong supabase-studio supabase-db; do
      print_logs "$name"
    done
    ;;
  *)
    echo "Unknown log target: ${TARGET}" >&2
    echo "Usage: npm run logs [all|collector|ollama|qdrant|supabase]" >&2
    echo "Examples:" >&2
    echo "  npm run logs" >&2
    echo "  npm run logs:collector" >&2
    echo "  FOLLOW=true npm run logs:collector" >&2
    echo "  TAIL=300 npm run logs -- supabase" >&2
    exit 1
    ;;
esac
