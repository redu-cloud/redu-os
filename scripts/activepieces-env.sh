#!/usr/bin/env bash
# Generate missing local Activepieces credentials and flow settings in .env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Copy .env.example or run npm run stack:up first." >&2
  exit 1
fi

generate_hex() {
  openssl rand -hex "$1"
}

get_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true
}

set_env() {
  local key="$1"
  local value="$2"

  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]

lines = path.read_text().splitlines()
out = []
changed = False

for line in lines:
    if line.startswith(key + "=") or line.startswith("#" + key + "="):
        out.append(f"{key}={value}")
        changed = True
    else:
        out.append(line)

if not changed:
    out.append(f"{key}={value}")

path.write_text("\n".join(out) + "\n")
PY
}

ensure_env() {
  local key="$1"
  local value="$2"
  local current

  current="$(get_env "$key")"
  if [ -z "$current" ] || [[ "$current" == replace-* ]]; then
    set_env "$key" "$value"
  fi
}

ensure_env "ACTIVEPIECES_PORT" "8080"
ensure_env "AP_FRONTEND_URL" "http://127.0.0.1:8080"
ensure_env "AP_ENCRYPTION_KEY" "$(generate_hex 16)"
ensure_env "AP_JWT_SECRET" "$(generate_hex 32)"
ensure_env "AP_POSTGRES_DATABASE" "activepieces"
ensure_env "AP_POSTGRES_USERNAME" "activepieces"
ensure_env "AP_POSTGRES_PASSWORD" "$(generate_hex 32)"
ensure_env "AP_EXECUTION_MODE" "UNSANDBOXED"
ensure_env "AP_CONTAINER_TYPE" "WORKER_AND_APP"
ensure_env "AP_TELEMETRY_ENABLED" "false"
ensure_env "AP_PIECES_SYNC_MODE" "OFFICIAL_AUTO"
ensure_env "AP_OWNER_EMAIL" "admin@example.com"
ensure_env "AP_OWNER_FIRST_NAME" "Local"
ensure_env "AP_OWNER_LAST_NAME" "Admin"
ensure_env "AP_OWNER_PASSWORD" "ChangeMeStrong123"
ensure_env "ACTIVEPIECES_FLOW_NAME" "reduOS-Event-Automation"
ensure_env "ACTIVEPIECES_FLOW_NAME_PREFIX" "reduOS"
ensure_env "ACTIVEPIECES_EVENT_API_KEY" "$(generate_hex 24)"
ensure_env "ACTIVEPIECES_DISCORD_WEBHOOK_URL" ""

echo "Activepieces env is ready in .env"
echo "  AP_FRONTEND_URL=$(get_env AP_FRONTEND_URL)"
echo "  ACTIVEPIECES_PORT=$(get_env ACTIVEPIECES_PORT)"
