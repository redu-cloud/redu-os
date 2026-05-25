#!/usr/bin/env bash
# Stop the same-machine modular stack services.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_DIR="${ROOT_DIR}/.local/supabase"
COMPOSE_DIR="${ROOT_DIR}/compose"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

cd "$COMPOSE_DIR"
podman-compose -f collector.yml -f collector.same-machine.yml down 2>/dev/null || true
podman-compose -f qdrant.yml down 2>/dev/null || true
podman-compose -f ollama.yml down 2>/dev/null || true

if [ -d "$SUPABASE_DIR" ]; then
  cd "$SUPABASE_DIR"
  podman-compose --env-file .env down
fi

echo "Same-machine modular reduOS stack stopped."
