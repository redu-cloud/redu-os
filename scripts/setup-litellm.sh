#!/usr/bin/env bash
# Wait for local LiteLLM and verify the configured model list.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:litellm:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/litellm-env.sh" >/dev/null

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

LITELLM_URL="${LITELLM_URL:-http://127.0.0.1:4000}"
LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-}"

if [ -z "$LITELLM_MASTER_KEY" ]; then
  echo "LITELLM_MASTER_KEY is required." >&2
  exit 1
fi

echo "Waiting for LiteLLM at ${LITELLM_URL}..."
for _ in $(seq 1 90); do
  if curl -fsS "${LITELLM_URL}/v1/models" \
    -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" >/dev/null 2>&1; then
    echo "LiteLLM is ready."
    echo "  URL: ${LITELLM_URL}"
    echo "  UI: ${LITELLM_URL}/ui"
    echo "  API key: ${LITELLM_MASTER_KEY}"
    echo "  Default chat model: ${LITELLM_DEFAULT_CHAT_MODEL:-local-deepseek}"
    exit 0
  fi
  sleep 3
done

echo "LiteLLM did not become ready in time. Check logs with npm run logs:litellm." >&2
exit 1
