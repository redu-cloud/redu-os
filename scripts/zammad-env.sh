#!/usr/bin/env bash
# Prepare the official local Zammad compose bundle and generated env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
LOCAL_DIR="${ROOT_DIR}/.local"
ZAMMAD_DIR="${LOCAL_DIR}/zammad"

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
  local file="$1"
  local key="$2"
  local value="$3"

  python3 - "$file" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]

lines = path.read_text().splitlines() if path.exists() else []
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

ensure_project_env() {
  local key="$1"
  local value="$2"
  local current

  current="$(get_env "$key")"
  if [ -z "$current" ] || [[ "$current" == replace-* ]] || [[ "$current" == your-* ]]; then
    set_env "$ENV_FILE" "$key" "$value"
  fi
}

ensure_project_env "ZAMMAD_PORT" "8081"
ensure_project_env "ZAMMAD_URL" "http://127.0.0.1:8081"
ensure_project_env "ZAMMAD_REPO_URL" "https://github.com/zammad/zammad-docker-compose.git"
ensure_project_env "ZAMMAD_REPO_REF" "master"
ensure_project_env "ZAMMAD_ADMIN_EMAIL" "admin@example.com"
ensure_project_env "ZAMMAD_ADMIN_PASSWORD" "ChangeMeStrong123"
ensure_project_env "ZAMMAD_ADMIN_FIRSTNAME" "Local"
ensure_project_env "ZAMMAD_ADMIN_LASTNAME" "Admin"
ensure_project_env "ZAMMAD_ORGANIZATION" "reduOS-Support"
ensure_project_env "ZAMMAD_FQDN" "localhost"
ensure_project_env "ZAMMAD_HTTP_TYPE" "http"
ensure_project_env "ZAMMAD_ELASTICSEARCH_ENABLED" "false"
ensure_project_env "ZAMMAD_SECRET_KEY_BASE" "$(generate_hex 64)"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$LOCAL_DIR"

if [ ! -d "${ZAMMAD_DIR}/.git" ]; then
  echo "Fetching official Zammad compose files..."
  git clone "$ZAMMAD_REPO_URL" "$ZAMMAD_DIR"
fi

cd "$ZAMMAD_DIR"
git fetch origin "$ZAMMAD_REPO_REF"
git reset --hard "FETCH_HEAD"

python3 - "${ZAMMAD_DIR}/docker-compose.yml" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
content = path.read_text()
replacements = {
    "image: elasticsearch:${ELASTICSEARCH_VERSION:-9.4.1}": "image: docker.io/library/elasticsearch:${ELASTICSEARCH_VERSION:-9.4.1}",
    "image: memcached:${MEMCACHE_VERSION:-1.6.42-alpine}": "image: docker.io/library/memcached:${MEMCACHE_VERSION:-1.6.42-alpine}",
    "image: postgres:${POSTGRES_VERSION:-17.10-alpine}": "image: docker.io/library/postgres:${POSTGRES_VERSION:-17.10-alpine}",
    "image: redis:${REDIS_VERSION:-8.6.3-alpine}": "image: docker.io/library/redis:${REDIS_VERSION:-8.6.3-alpine}",
}
for old, new in replacements.items():
    content = content.replace(old, new)
path.write_text(content)
PY

if [ ! -f .env ]; then
  cp .env.dist .env
fi

set_env "${ZAMMAD_DIR}/.env" "NGINX_PORT" "${ZAMMAD_PORT:-8081}"
set_env "${ZAMMAD_DIR}/.env" "NGINX_EXPOSE_PORT" "${ZAMMAD_PORT:-8081}"
set_env "${ZAMMAD_DIR}/.env" "ZAMMAD_HTTP_TYPE" "${ZAMMAD_HTTP_TYPE:-http}"
set_env "${ZAMMAD_DIR}/.env" "ZAMMAD_FQDN" "${ZAMMAD_FQDN:-localhost}"
set_env "${ZAMMAD_DIR}/.env" "ELASTICSEARCH_ENABLED" "${ZAMMAD_ELASTICSEARCH_ENABLED:-false}"
set_env "${ZAMMAD_DIR}/.env" "SECRET_KEY_BASE" "${ZAMMAD_SECRET_KEY_BASE}"

if [ "${ZAMMAD_ELASTICSEARCH_ENABLED:-false}" = "false" ]; then
  python3 - "${ZAMMAD_DIR}/docker-compose.yml" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
lines = path.read_text().splitlines()
out = []
skip = False

for line in lines:
    if line.startswith("  zammad-elasticsearch:"):
        skip = True
        continue
    if skip and line.startswith("  zammad-init:"):
        skip = False
    if not skip:
        out.append(line)

path.write_text("\n".join(out) + "\n")
PY
fi

echo "Zammad env is ready:"
echo "  Runtime compose: ${ZAMMAD_DIR}"
echo "  ZAMMAD_URL=${ZAMMAD_URL:-http://127.0.0.1:8081}"
echo "  ZAMMAD_PORT=${ZAMMAD_PORT:-8081}"
echo "  ZAMMAD_ADMIN_EMAIL=${ZAMMAD_ADMIN_EMAIL:-admin@example.com}"
