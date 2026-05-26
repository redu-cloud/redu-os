#!/usr/bin/env bash
# Generate and persist local LangGraph settings, then mirror them into .env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
LOCAL_ENV="${ROOT_DIR}/.local/langgraph-local.env"

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

collector_key="$(get_env_from "$ENV_FILE" COLLECTOR_API_KEY)"
litellm_key="$(get_env_from "$ENV_FILE" LITELLM_MASTER_KEY)"
litellm_host="$(get_env_from "$ENV_FILE" LITELLM_HOST)"
litellm_model="$(get_env_from "$ENV_FILE" LITELLM_DEFAULT_CHAT_MODEL)"

ensure_env "LANGGRAPH_ENABLED" "true"
ensure_env "LANGGRAPH_PORT" "3010"
ensure_env "LANGGRAPH_URL" "http://127.0.0.1:3010"
ensure_env "LANGGRAPH_API_KEY" "lg-$(generate_hex 32)"

if [ -n "$litellm_key" ] && [[ "$litellm_key" != replace-* ]]; then
  ensure_env "LANGGRAPH_AI_PROVIDER" "openai-compatible"
  ensure_env "LANGGRAPH_AI_BASE_URL" "${litellm_host:-http://host.containers.internal:4000}/v1"
  ensure_env "LANGGRAPH_AI_API_KEY" "$litellm_key"
  ensure_env "LANGGRAPH_AI_MODEL" "${litellm_model:-local-deepseek}"
else
  ensure_env "LANGGRAPH_AI_PROVIDER" "ollama"
  ensure_env "LANGGRAPH_AI_BASE_URL" ""
  ensure_env "LANGGRAPH_AI_API_KEY" ""
  ensure_env "LANGGRAPH_AI_MODEL" "$(get_env_from "$ENV_FILE" OLLAMA_MODEL)"
fi

ensure_env "LANGGRAPH_AI_ENABLED" "true"
ensure_env "LANGGRAPH_MEMORY_ENABLED" "true"
ensure_env "LANGGRAPH_MEMORY_SEARCH_URL" "http://host.containers.internal:3005/v1/memory/search"
ensure_env "LANGGRAPH_MEMORY_API_KEY" "$collector_key"
ensure_env "LANGGRAPH_MEMORY_SEARCH_LIMIT" "5"
ensure_env "LANGGRAPH_COLLECTOR_ENABLED" "true"
ensure_env "LANGGRAPH_COLLECTOR_URL" "http://host.containers.internal:3005"
ensure_env "LANGGRAPH_COLLECTOR_API_KEY" "$collector_key"
ensure_env "LANGGRAPH_AUTOMATION_ENABLED" "false"
ensure_env "LANGGRAPH_AUTOMATION_WEBHOOK_URL" "$(get_env_from "$ENV_FILE" AUTOMATION_WEBHOOK_URL)"
ensure_env "LANGGRAPH_AUTOMATION_WEBHOOK_API_KEY" "$(get_env_from "$ENV_FILE" AUTOMATION_WEBHOOK_API_KEY)"
ensure_env "LANGGRAPH_REQUIRE_HUMAN_APPROVAL_FOR_HIGH_RISK" "true"

echo "LangGraph env is ready in .env"
echo "  LANGGRAPH_URL=$(get_env_from "$ENV_FILE" LANGGRAPH_URL)"
echo "  LANGGRAPH_API_KEY=$(get_env_from "$ENV_FILE" LANGGRAPH_API_KEY)"
echo "  LANGGRAPH_AI_PROVIDER=$(get_env_from "$ENV_FILE" LANGGRAPH_AI_PROVIDER)"
echo "  LANGGRAPH_AI_MODEL=$(get_env_from "$ENV_FILE" LANGGRAPH_AI_MODEL)"
echo "  Local secrets: $LOCAL_ENV"
