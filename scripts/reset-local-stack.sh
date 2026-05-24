#!/usr/bin/env bash
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
        Ollama models, generated Supabase files, Qdrant data, .env, and
        .local/supabase-local.env.
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
for name in redu-os-collector redu-os-qdrant redu-os-ollama; do
  podman rm -f "$name" >/dev/null 2>&1 || true
done

echo "Removing stopped Supabase containers..."
if command -v podman >/dev/null 2>&1; then
  while IFS= read -r name; do
    [ -n "$name" ] && podman rm -f "$name" >/dev/null 2>&1 || true
  done < <(podman ps -a --format '{{.Names}}' | grep '^supabase-' || true)
fi

case "$RESET_MODE" in
  data)
    remove_path "${LOCAL_DIR}/qdrant"
    remove_path "${LOCAL_DIR}/supabase/volumes/db/data"
    remove_path "${LOCAL_DIR}/supabase/volumes/storage"
    remove_path "${LOCAL_DIR}/supabase/volumes/functions"
    ;;
  all)
    remove_path "${ROOT_DIR}/.env"
    remove_path "${LOCAL_DIR}/supabase-local.env"
    remove_path "${LOCAL_DIR}/qdrant"
    remove_path "${LOCAL_DIR}/ollama"
    remove_path "${LOCAL_DIR}/supabase"
    remove_path "${LOCAL_DIR}/supabase-src"
    ;;
esac

echo
echo "Local reset complete (${RESET_MODE})."
echo "Run npm run stack:up to recreate the stack."
