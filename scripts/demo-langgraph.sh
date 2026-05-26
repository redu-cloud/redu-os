#!/usr/bin/env bash
# Run a LangGraph agent demo against the local modular service.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:local:up first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

LANGGRAPH_URL="${LANGGRAPH_URL:-http://127.0.0.1:3010}"

if [ -z "${LANGGRAPH_API_KEY:-}" ]; then
  echo "LANGGRAPH_API_KEY is missing. Run npm run modular:langgraph:up first." >&2
  exit 1
fi

curl -sS -X POST "${LANGGRAPH_URL}/v1/agents/support" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${LANGGRAPH_API_KEY}" \
  -d '{
    "source": "zammad",
    "severity": "high",
    "message": "A customer cannot finish onboarding after connecting their first data source.",
    "user_email": "founder@example.com",
    "user_name": "Demo Founder",
    "metadata": {
      "plan": "startup",
      "area": "onboarding"
    },
    "record_to_collector": false,
    "trigger_automation": false
  }' | jq
