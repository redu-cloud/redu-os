#!/usr/bin/env bash
# Generate and persist local LiteLLM settings, then mirror them into .env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
LOCAL_ENV="${ROOT_DIR}/.local/litellm-local.env"
APP_DIR="${ROOT_DIR}/.local/litellm"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Copy .env.example or run npm run stack:up first." >&2
  exit 1
fi

mkdir -p "$APP_DIR"
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

ensure_env "LITELLM_ENABLED" "true"
ensure_env "LITELLM_IMAGE" "ghcr.io/berriai/litellm:main-latest"
ensure_env "LITELLM_PORT" "4000"
ensure_env "LITELLM_URL" "http://127.0.0.1:4000"
ensure_env "LITELLM_HOST" "http://host.containers.internal:4000"
ensure_env "LITELLM_NUM_WORKERS" "4"
ensure_env "LITELLM_MASTER_KEY" "sk-$(generate_hex 32)"
ensure_env "LITELLM_SALT_KEY" "sk-$(generate_hex 32)"
ensure_env "LITELLM_POSTGRES_DATABASE" "litellm"
ensure_env "LITELLM_POSTGRES_USERNAME" "litellm"
ensure_env "LITELLM_POSTGRES_PASSWORD" "$(generate_hex 32)"
ensure_env "LITELLM_DEFAULT_CHAT_MODEL" "local-deepseek"
ensure_env "LITELLM_DEFAULT_EMBED_MODEL" "local-embeddings"

ensure_env "OLLAMA_ENABLED" "true"
ensure_env "OLLAMA_LITELLM_URL" "http://host.containers.internal:${OLLAMA_PORT:-11435}"
ensure_env "OLLAMA_CHAT_MODEL" "${OLLAMA_MODEL:-deepseek-r1:1.5b}"
ensure_env "OLLAMA_EMBED_MODEL" "${OLLAMA_EMBED_MODEL:-nomic-embed-text}"

ensure_env "OPENAI_ENABLED" "false"
ensure_env "OPENAI_API_KEY" ""
ensure_env "OPENAI_CHAT_MODEL" "gpt-4o-mini"
ensure_env "ANTHROPIC_ENABLED" "false"
ensure_env "ANTHROPIC_API_KEY" ""
ensure_env "ANTHROPIC_CHAT_MODEL" "claude-3-5-haiku-latest"
ensure_env "GEMINI_ENABLED" "false"
ensure_env "GEMINI_API_KEY" ""
ensure_env "GEMINI_CHAT_MODEL" "gemini/gemini-1.5-flash"
ensure_env "GROQ_ENABLED" "false"
ensure_env "GROQ_API_KEY" ""
ensure_env "GROQ_CHAT_MODEL" "groq/llama-3.1-8b-instant"
ensure_env "OPENROUTER_ENABLED" "false"
ensure_env "OPENROUTER_API_KEY" ""
ensure_env "OPENROUTER_CHAT_MODEL" "openrouter/meta-llama/llama-3.1-8b-instruct"

set_env_in "$ENV_FILE" "AI_PROVIDER" "litellm"
set_env_in "$ENV_FILE" "AI_CHAT_BASE_URL" "$(get_env_from "$ENV_FILE" LITELLM_HOST)/v1"
set_env_in "$ENV_FILE" "AI_CHAT_API_KEY" "$(get_env_from "$ENV_FILE" LITELLM_MASTER_KEY)"
set_env_in "$ENV_FILE" "AI_CHAT_MODEL" "$(get_env_from "$ENV_FILE" LITELLM_DEFAULT_CHAT_MODEL)"
set_env_in "$ENV_FILE" "AI_EMBEDDING_BASE_URL" "$(get_env_from "$ENV_FILE" LITELLM_HOST)/v1"
set_env_in "$ENV_FILE" "AI_EMBEDDING_API_KEY" "$(get_env_from "$ENV_FILE" LITELLM_MASTER_KEY)"
set_env_in "$ENV_FILE" "AI_EMBEDDING_MODEL" "$(get_env_from "$ENV_FILE" LITELLM_DEFAULT_EMBED_MODEL)"

python3 - "$ENV_FILE" "$APP_DIR/config.yaml" <<'PY'
from pathlib import Path
import sys

env_file = Path(sys.argv[1])
config_file = Path(sys.argv[2])

env = {}
for line in env_file.read_text().splitlines():
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    env[key] = value

def enabled(key: str) -> bool:
    return env.get(key, "false").lower() == "true"

def has_value(value: str | None) -> bool:
    if not value:
        return False
    return not any(marker in value for marker in ["YOUR_", "PASTE_", "CHANGE_ME", "AUTO_GENERATE", "replace-with-"])

models = []

ollama_url = env.get("OLLAMA_LITELLM_URL") or env.get("OLLAMA_URL", "")
if enabled("OLLAMA_ENABLED") and has_value(ollama_url):
    models.append({
        "model_name": "local-deepseek",
        "litellm_params": {
            "model": f"ollama/{env.get('OLLAMA_CHAT_MODEL', env.get('OLLAMA_MODEL', 'deepseek-r1:1.5b'))}",
            "api_base": ollama_url,
        },
        "model_info": {
            "description": "Local Ollama chat model for private reduOS mode",
        },
    })
    models.append({
        "model_name": "local-embeddings",
        "litellm_params": {
            "model": f"ollama/{env.get('OLLAMA_EMBED_MODEL', 'nomic-embed-text')}",
            "api_base": ollama_url,
        },
        "model_info": {
            "mode": "embedding",
            "description": "Local Ollama embedding model for reduOS memory",
        },
    })

if enabled("OPENAI_ENABLED") and has_value(env.get("OPENAI_API_KEY")):
    models.append({
        "model_name": "openai-default",
        "litellm_params": {
            "model": f"openai/{env.get('OPENAI_CHAT_MODEL', 'gpt-4o-mini')}",
            "api_key": "os.environ/OPENAI_API_KEY",
        },
    })

if enabled("ANTHROPIC_ENABLED") and has_value(env.get("ANTHROPIC_API_KEY")):
    models.append({
        "model_name": "claude-default",
        "litellm_params": {
            "model": f"anthropic/{env.get('ANTHROPIC_CHAT_MODEL', 'claude-3-5-haiku-latest')}",
            "api_key": "os.environ/ANTHROPIC_API_KEY",
        },
    })

if enabled("GEMINI_ENABLED") and has_value(env.get("GEMINI_API_KEY")):
    models.append({
        "model_name": "gemini-default",
        "litellm_params": {
            "model": env.get("GEMINI_CHAT_MODEL", "gemini/gemini-1.5-flash"),
            "api_key": "os.environ/GEMINI_API_KEY",
        },
    })

if enabled("GROQ_ENABLED") and has_value(env.get("GROQ_API_KEY")):
    models.append({
        "model_name": "groq-default",
        "litellm_params": {
            "model": env.get("GROQ_CHAT_MODEL", "groq/llama-3.1-8b-instant"),
            "api_key": "os.environ/GROQ_API_KEY",
        },
    })

if enabled("OPENROUTER_ENABLED") and has_value(env.get("OPENROUTER_API_KEY")):
    models.append({
        "model_name": "openrouter-default",
        "litellm_params": {
            "model": env.get("OPENROUTER_CHAT_MODEL", "openrouter/meta-llama/llama-3.1-8b-instruct"),
            "api_key": "os.environ/OPENROUTER_API_KEY",
        },
    })

if not models:
    models.append({
        "model_name": "configure-a-provider-first",
        "litellm_params": {
            "model": "openai/gpt-4o-mini",
            "api_key": "os.environ/OPENAI_API_KEY",
        },
        "model_info": {
            "description": "Placeholder. Enable Ollama or an external provider in .env.",
        },
    })

def scalar(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    return '"' + str(value).replace('"', '\\"') + '"'

def dump_item(item, indent=0):
    lines = []
    space = " " * indent
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, (dict, list)):
                lines.append(f"{space}{key}:")
                lines.extend(dump_item(value, indent + 2))
            else:
                lines.append(f"{space}{key}: {scalar(value)}")
    elif isinstance(item, list):
        for value in item:
            if isinstance(value, dict):
                lines.append(f"{space}-")
                lines.extend(dump_item(value, indent + 2))
            else:
                lines.append(f"{space}- {scalar(value)}")
    return lines

config = {
    "model_list": models,
    "general_settings": {
        "master_key": env.get("LITELLM_MASTER_KEY", ""),
        "database_url": f"postgresql://{env.get('LITELLM_POSTGRES_USERNAME', 'litellm')}:{env.get('LITELLM_POSTGRES_PASSWORD', '')}@litellm-postgres:5432/{env.get('LITELLM_POSTGRES_DATABASE', 'litellm')}",
    },
    "litellm_settings": {
        "drop_params": True,
        "set_verbose": False,
        "request_timeout": 120,
        "num_retries": 2,
    },
    "router_settings": {
        "routing_strategy": "simple-shuffle",
        "num_retries": 2,
        "timeout": 120,
    },
}

config_file.write_text("\n".join(dump_item(config)) + "\n")
PY
chmod 600 "$APP_DIR/config.yaml"

echo "LiteLLM env is ready in .env"
echo "  LITELLM_URL=$(get_env_from "$ENV_FILE" LITELLM_URL)"
echo "  LITELLM_HOST=$(get_env_from "$ENV_FILE" LITELLM_HOST)"
echo "  LITELLM_MASTER_KEY=$(get_env_from "$ENV_FILE" LITELLM_MASTER_KEY)"
echo "  AI_PROVIDER=$(get_env_from "$ENV_FILE" AI_PROVIDER)"
echo "  AI_CHAT_MODEL=$(get_env_from "$ENV_FILE" AI_CHAT_MODEL)"
echo "  Local secrets: $LOCAL_ENV"
