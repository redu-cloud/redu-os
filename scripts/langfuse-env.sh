#!/usr/bin/env bash
# Generate and persist local Langfuse settings, then mirror them into .env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
LOCAL_ENV="${ROOT_DIR}/.local/langfuse-local.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Copy .env.example or run npm run stack:up first." >&2
  exit 1
fi

mkdir -p "$(dirname "$LOCAL_ENV")"
touch "$LOCAL_ENV"
chmod 600 "$LOCAL_ENV"

generate_hex() {
  openssl rand -hex "$1"
}

get_env_from() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | tail -n1 | cut -d= -f2- || true
}

set_env_in() {
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

ensure_env() {
  local key="$1"
  local default_value="$2"
  local project_value
  local local_value
  local value

  project_value="$(get_env_from "$ENV_FILE" "$key")"
  local_value="$(get_env_from "$LOCAL_ENV" "$key")"

  if [ -n "$local_value" ] && [[ "$local_value" != replace-* ]]; then
    value="$local_value"
  elif [ -n "$project_value" ] && [[ "$project_value" != replace-* ]]; then
    value="$project_value"
  else
    value="$default_value"
  fi

  set_env_in "$LOCAL_ENV" "$key" "$value"
  set_env_in "$ENV_FILE" "$key" "$value"
}

ensure_env "LANGFUSE_ENABLED" "true"
ensure_env "LANGFUSE_PORT" "3007"
ensure_env "LANGFUSE_URL" "http://127.0.0.1:3007"
ensure_env "LANGFUSE_HOST" "http://host.containers.internal:3007"
ensure_env "LANGFUSE_WEB_IMAGE" "docker.io/langfuse/langfuse:3"
ensure_env "LANGFUSE_WORKER_IMAGE" "docker.io/langfuse/langfuse-worker:3"
ensure_env "LANGFUSE_ADMIN_EMAIL" "admin@example.com"
ensure_env "LANGFUSE_ADMIN_NAME" "Local-Admin"
ensure_env "LANGFUSE_ADMIN_PASSWORD" "ChangeMeStrong123"
ensure_env "LANGFUSE_INIT_ORG_ID" "reduos-org"
ensure_env "LANGFUSE_INIT_ORG_NAME" "reduOS"
ensure_env "LANGFUSE_INIT_PROJECT_ID" "reduos-project"
ensure_env "LANGFUSE_INIT_PROJECT_NAME" "reduOS-AI"
ensure_env "LANGFUSE_PUBLIC_KEY" "pk-lf-$(generate_hex 16)"
ensure_env "LANGFUSE_SECRET_KEY" "sk-lf-$(generate_hex 32)"
ensure_env "LANGFUSE_NEXTAUTH_SECRET" "$(generate_hex 32)"
ensure_env "LANGFUSE_SALT" "$(generate_hex 16)"
ensure_env "LANGFUSE_ENCRYPTION_KEY" "$(generate_hex 32)"
ensure_env "LANGFUSE_TELEMETRY_ENABLED" "false"
ensure_env "LANGFUSE_POSTGRES_DATABASE" "langfuse"
ensure_env "LANGFUSE_POSTGRES_USERNAME" "langfuse"
ensure_env "LANGFUSE_POSTGRES_PASSWORD" "$(generate_hex 32)"
ensure_env "LANGFUSE_CLICKHOUSE_USER" "clickhouse"
ensure_env "LANGFUSE_CLICKHOUSE_PASSWORD" "$(generate_hex 32)"
ensure_env "LANGFUSE_CLICKHOUSE_HTTP_PORT" "8123"
ensure_env "LANGFUSE_CLICKHOUSE_NATIVE_PORT" "9001"
ensure_env "LANGFUSE_REDIS_PASSWORD" "$(generate_hex 32)"
ensure_env "LANGFUSE_MINIO_ROOT_USER" "minio"
ensure_env "LANGFUSE_MINIO_ROOT_PASSWORD" "$(generate_hex 32)"
ensure_env "LANGFUSE_MINIO_PORT" "9090"
ensure_env "LANGFUSE_MINIO_CONSOLE_PORT" "9091"
ensure_env "LANGFUSE_WORKER_PORT" "3030"
ensure_env "LANGFUSE_S3_BUCKET" "langfuse"

if [ "$(get_env_from "$ENV_FILE" LANGFUSE_HOST)" = "http://127.0.0.1:3007" ]; then
  set_env_in "$LOCAL_ENV" "LANGFUSE_HOST" "http://host.containers.internal:3007"
  set_env_in "$ENV_FILE" "LANGFUSE_HOST" "http://host.containers.internal:3007"
fi

echo "Langfuse env is ready in .env"
echo "  LANGFUSE_URL=$(get_env_from "$ENV_FILE" LANGFUSE_URL)"
echo "  LANGFUSE_HOST=$(get_env_from "$ENV_FILE" LANGFUSE_HOST)"
echo "  LANGFUSE_ADMIN_EMAIL=$(get_env_from "$ENV_FILE" LANGFUSE_ADMIN_EMAIL)"
echo "  LANGFUSE_PUBLIC_KEY=$(get_env_from "$ENV_FILE" LANGFUSE_PUBLIC_KEY)"
echo "  Local secrets: $LOCAL_ENV"
