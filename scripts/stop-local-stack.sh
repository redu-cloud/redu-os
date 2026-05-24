#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_DIR="${ROOT_DIR}/.local/supabase"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

cd "$ROOT_DIR"
podman-compose -f podman-compose.yml down

if [ -d "$SUPABASE_DIR" ]; then
  cd "$SUPABASE_DIR"
  podman-compose --env-file .env down
fi

echo "Local reduOS stack stopped."
