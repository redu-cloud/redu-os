#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3005}"
API_KEY="${COLLECTOR_API_KEY:-change-me-please}"

event_response="$(curl -sS -X POST "$BASE_URL/v1/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "type": "support.ticket.created",
    "source": "zammad",
    "user": {
      "email": "customer@example.com",
      "name": "Demo Customer"
    },
    "message": "I cannot finish onboarding",
    "severity": "medium",
    "metadata": {
      "ticket_id": "123"
    }
  }')"

echo "$event_response" | jq .

event_id="$(echo "$event_response" | jq -r '.event_id')"
insight_id="$(echo "$event_response" | jq -r '.insight_id // empty')"

action_payload="$(jq -n \
  --arg event_id "$event_id" \
  --arg insight_id "$insight_id" \
  '{
    startup_event_id: $event_id,
    action_type: "create_support_task",
    status: "completed",
    target: "activepieces",
    payload: {
      task: "Send onboarding checklist"
    },
    result: {
      task_created: true
    },
    completed_at: now | todate
  } + if $insight_id == "" then {} else { ai_insight_id: $insight_id } end')"

action_response="$(curl -sS -X POST "$BASE_URL/v1/actions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "$action_payload")"

echo "$action_response" | jq .

action_id="$(echo "$action_response" | jq -r '.action_id')"

feedback_response="$(curl -sS -X POST "$BASE_URL/v1/feedback" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "$(jq -n \
    --arg event_id "$event_id" \
    --arg action_id "$action_id" \
    '{
      startup_event_id: $event_id,
      ai_action_id: $action_id,
      feedback_type: "ticket_resolved",
      score: 1,
      result: "resolved",
      metadata: {
        resolution_time_minutes: 42,
        ai_recommendation_used: true
      }
    }')")"

echo "$feedback_response" | jq .

curl -sS "$BASE_URL/v1/context/similar?type=support.ticket.created&source=zammad&limit=5" \
  -H "X-API-Key: $API_KEY" | jq .
