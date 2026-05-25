#!/usr/bin/env bash
# Generate missing local Umami settings in .env.
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
  if [ -z "$current" ] || [[ "$current" == replace-* ]] || { [ "$key" = "UMAMI_WEBSITE_NAME" ] && [[ "$current" =~ [[:space:]] ]]; }; then
    set_env "$key" "$value"
  fi
}

ensure_env "UMAMI_PORT" "3002"
ensure_env "UMAMI_URL" "http://127.0.0.1:3002"
ensure_env "UMAMI_ADMIN_USERNAME" "admin"
ensure_env "UMAMI_OLD_ADMIN_PASSWORD" "umami"
ensure_env "UMAMI_ADMIN_PASSWORD" "ChangeMeStrong123"
ensure_env "UMAMI_WEBSITE_NAME" "reduOS-Demo"
ensure_env "UMAMI_WEBSITE_DOMAIN" "redu-os.local"
ensure_env "UMAMI_POSTGRES_DATABASE" "umami"
ensure_env "UMAMI_POSTGRES_USERNAME" "umami"
ensure_env "UMAMI_POSTGRES_PASSWORD" "$(generate_hex 32)"
ensure_env "UMAMI_APP_SECRET" "$(generate_hex 32)"

echo "Umami env is ready in .env"
echo "  UMAMI_URL=$(get_env UMAMI_URL)"
echo "  UMAMI_PORT=$(get_env UMAMI_PORT)"
echo "  UMAMI_ADMIN_USERNAME=$(get_env UMAMI_ADMIN_USERNAME)"
