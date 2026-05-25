#!/usr/bin/env bash
# Search Qdrant memory through the collector API.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_ENV="${ROOT_DIR}/.local/supabase-local.env"

if ! command -v jq >/dev/null 2>&1; then
  echo "Missing required command: jq" >&2
  exit 1
fi

if [ -f "$SUPABASE_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
  set +a
fi

COLLECTOR_URL="${COLLECTOR_URL:-http://127.0.0.1:3005}"
COLLECTOR_API_KEY="${COLLECTOR_API_KEY:-change-me-please}"
QUERY="${*:-customers blocked during onboarding because keypair selection failed}"
LIMIT="${LIMIT:-5}"

response="$(curl -fsS -X POST "${COLLECTOR_URL}/v1/memory/search" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d "$(jq -n \
    --arg query "$QUERY" \
    --argjson limit "$LIMIT" \
    '{ query: $query, limit: $limit }')")"

echo "reduOS memory search"
echo
echo "Query:"
echo "  ${QUERY}"
echo
echo "Matches:"

if [ "$(jq '.items | length' <<<"$response")" = "0" ]; then
  echo "  none"
  exit 0
fi

jq -r '.items[] |
  "  score:   \((.score * 100 | round) / 100)\n  type:    \(.event.type)\n  source:  \(.event.source)\n  user:    \(.event.user_email // "unknown")\n  message: \(.event.message)\n"' <<<"$response"
