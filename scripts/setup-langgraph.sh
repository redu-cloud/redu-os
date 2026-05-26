#!/usr/bin/env bash
# Wait for local LangGraph and verify the agent API.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:langgraph:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/langgraph-env.sh" >/dev/null

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

LANGGRAPH_URL="${LANGGRAPH_URL:-http://127.0.0.1:3010}"
LANGGRAPH_API_KEY="${LANGGRAPH_API_KEY:-}"

if [ -z "$LANGGRAPH_API_KEY" ]; then
  echo "LANGGRAPH_API_KEY is required." >&2
  exit 1
fi

echo "Waiting for LangGraph at ${LANGGRAPH_URL}..."
for _ in $(seq 1 120); do
  if curl -fsS "${LANGGRAPH_URL}/health" >/dev/null 2>&1; then
    echo "LangGraph is ready."
    echo "  URL: ${LANGGRAPH_URL}"
    echo "  API key: ${LANGGRAPH_API_KEY}"
    echo "  AI provider: ${LANGGRAPH_AI_PROVIDER:-openai-compatible}"
    echo "  AI model: ${LANGGRAPH_AI_MODEL:-local-deepseek}"
    exit 0
  fi
  sleep 3
done

echo "LangGraph did not become ready in time. Check logs with npm run logs:langgraph." >&2
exit 1
