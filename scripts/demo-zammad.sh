#!/usr/bin/env bash
# Send a Zammad support-ticket payload through the collector.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_ENV="${ROOT_DIR}/.local/supabase-local.env"

if ! command -v jq >/dev/null 2>&1; then
  echo "Missing required command: jq" >&2
  exit 1
fi

if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
  set +a
fi

if [ -f "$SUPABASE_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
  set +a
fi

COLLECTOR_URL="${COLLECTOR_URL:-http://127.0.0.1:3005}"
COLLECTOR_API_KEY="${COLLECTOR_API_KEY:-change-me-please}"

response="$(curl -fsS -X POST "${COLLECTOR_URL}/v1/events/zammad" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "name": "Milos Demo",
    "email": "milos@example.com",
    "title": "Server is down",
    "message": "My production server is down after a deploy and I need help quickly.",
    "priority": "high"
  }')"

echo "reduOS Zammad ticket demo"
echo
jq -r '
  "Event:\n" +
  "  id:         \(.event_id)\n" +
  "  action_id:  \(.action_id // "none")\n" +
  "  automation: \(
    if .automation.sent == true then
      "sent to " + ((.automation.targets // 1) | tostring) + " target(s)"
    else
      (.automation.reason // .automation.error // "not sent")
    end
  )\n\n" +
  "AI insight:\n" +
  "  category:   \(.insight.category)\n" +
  "  priority:   \(.insight.priority)\n" +
  "  sentiment:  \(.insight.sentiment)\n" +
  "  summary:    \(.insight.summary)\n" +
  "  action:     \(.insight.recommended_action)"
' <<<"$response"
