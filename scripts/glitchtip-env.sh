#!/usr/bin/env bash
# Generate missing local GlitchTip settings in .env.
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

ensure_env "GLITCHTIP_PORT" "8001"
ensure_env "GLITCHTIP_URL" "http://127.0.0.1:8001"
ensure_env "GLITCHTIP_IMAGE" "docker.io/glitchtip/glitchtip:latest"
ensure_env "GLITCHTIP_ADMIN_EMAIL" "admin@example.com"
ensure_env "GLITCHTIP_ADMIN_USERNAME" "admin"
ensure_env "GLITCHTIP_ADMIN_PASSWORD" "ChangeMeStrong123!"
ensure_env "GLITCHTIP_ORG_NAME" "reduOS"
ensure_env "GLITCHTIP_TEAM_NAME" "Default-Team"
ensure_env "GLITCHTIP_PROJECT_NAME" "AI-OS-Demo"
ensure_env "GLITCHTIP_SECRET_KEY" "$(generate_hex 48)"
ensure_env "GLITCHTIP_POSTGRES_DATABASE" "glitchtip"
ensure_env "GLITCHTIP_POSTGRES_USERNAME" "glitchtip"
ensure_env "GLITCHTIP_POSTGRES_PASSWORD" "$(generate_hex 32)"
ensure_env "GLITCHTIP_REDIS_PASSWORD" "$(generate_hex 32)"
ensure_env "GLITCHTIP_EMAIL_URL" "consolemail://"
ensure_env "GLITCHTIP_DEFAULT_FROM_EMAIL" "no-reply@example.com"
ensure_env "GLITCHTIP_ENABLE_USER_REGISTRATION" "true"
ensure_env "GLITCHTIP_ENABLE_ORGANIZATION_CREATION" "true"
ensure_env "GLITCHTIP_ENABLE_UPTIME" "true"
ensure_env "GLITCHTIP_ENABLE_LOGS" "true"
ensure_env "GLITCHTIP_ENABLE_MCP" "false"
ensure_env "GLITCHTIP_INSTANCE_NAME" "reduOS-GlitchTip"

echo "GlitchTip env is ready in .env"
echo "  GLITCHTIP_URL=$(get_env GLITCHTIP_URL)"
echo "  GLITCHTIP_PORT=$(get_env GLITCHTIP_PORT)"
echo "  GLITCHTIP_ADMIN_EMAIL=$(get_env GLITCHTIP_ADMIN_EMAIL)"
