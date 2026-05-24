#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3005}"
API_KEY="${COLLECTOR_API_KEY:-change-me-please}"
EVENT_ID="${EVENT_ID:-00000000-0000-0000-0000-000000000000}"
ACTION_ID="${ACTION_ID:-}"

payload="$(jq -n \
  --arg event_id "$EVENT_ID" \
  --arg action_id "$ACTION_ID" \
  '{
    startup_event_id: $event_id,
    feedback_type: "ticket_resolved",
    score: 1,
    result: "resolved",
    metadata: {
      resolution_time_minutes: 42,
      ai_recommendation_used: true
    }
  } + if $action_id == "" then {} else { ai_action_id: $action_id } end')"

curl -sS -X POST "$BASE_URL/v1/feedback" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "$payload"
