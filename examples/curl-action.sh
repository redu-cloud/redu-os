#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3005}"
API_KEY="${COLLECTOR_API_KEY:-change-me-please}"
EVENT_ID="${EVENT_ID:-00000000-0000-0000-0000-000000000000}"
INSIGHT_ID="${INSIGHT_ID:-}"

payload="$(jq -n \
  --arg event_id "$EVENT_ID" \
  --arg insight_id "$INSIGHT_ID" \
  '{
    startup_event_id: $event_id,
    action_type: "send_discord_alert",
    status: "completed",
    target: "activepieces",
    payload: {
      channel: "founder-alerts",
      message: "Support ticket needs attention"
    },
    result: {
      delivered: true
    },
    completed_at: now | todate
  } + if $insight_id == "" then {} else { ai_insight_id: $insight_id } end')"

curl -sS -X POST "$BASE_URL/v1/actions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "$payload"
