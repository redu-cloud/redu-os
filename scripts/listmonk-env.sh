#!/usr/bin/env bash
# Generate missing local Listmonk settings in .env and config.toml.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
LISTMONK_DIR="${ROOT_DIR}/.local/listmonk"
CONFIG_FILE="${LISTMONK_DIR}/config.toml"

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
  if [ -z "$current" ] || [[ "$current" == replace-* ]] || [[ "$current" == your-* ]]; then
    set_env "$key" "$value"
  fi
}

ensure_env "LISTMONK_PORT" "9000"
ensure_env "LISTMONK_URL" "http://127.0.0.1:9000"
ensure_env "LISTMONK_IMAGE" "docker.io/listmonk/listmonk:latest"
ensure_env "LISTMONK_ADMIN_USERNAME" "admin"
ensure_env "LISTMONK_ADMIN_PASSWORD" "ChangeMeStrong123"
ensure_env "LISTMONK_LIST_NAME" "Beta-Users"
ensure_env "LISTMONK_LIST_TYPE" "public"
ensure_env "LISTMONK_LIST_OPTIN" "single"
ensure_env "LISTMONK_LIST_TAG" "waitlist"
ensure_env "LISTMONK_POSTGRES_DATABASE" "listmonk"
ensure_env "LISTMONK_POSTGRES_USERNAME" "listmonk"
ensure_env "LISTMONK_POSTGRES_PASSWORD" "$(generate_hex 32)"

mkdir -p "$LISTMONK_DIR"

cat > "$CONFIG_FILE" <<EOF
[app]
address = "0.0.0.0:9000"
admin_username = "$(get_env LISTMONK_ADMIN_USERNAME)"
admin_password = "$(get_env LISTMONK_ADMIN_PASSWORD)"

[db]
host = "listmonk-postgres"
port = 5432
user = "$(get_env LISTMONK_POSTGRES_USERNAME)"
password = "$(get_env LISTMONK_POSTGRES_PASSWORD)"
database = "$(get_env LISTMONK_POSTGRES_DATABASE)"
ssl_mode = "disable"
max_open = 25
max_idle = 25
max_lifetime = "300s"
EOF

echo "Listmonk env is ready in .env"
echo "  LISTMONK_URL=$(get_env LISTMONK_URL)"
echo "  LISTMONK_PORT=$(get_env LISTMONK_PORT)"
echo "  LISTMONK_ADMIN_USERNAME=$(get_env LISTMONK_ADMIN_USERNAME)"
