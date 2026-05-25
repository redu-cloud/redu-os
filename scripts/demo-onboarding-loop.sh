#!/usr/bin/env bash
# Run the onboarding support loop demo and record action/feedback rows.
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
QDRANT_COLLECTION="${QDRANT_COLLECTION:-redu_os_events}"

post_json() {
  local path="$1"
  local payload="$2"

  curl -fsS -X POST "${COLLECTOR_URL}${path}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${COLLECTOR_API_KEY}" \
    -d "$payload"
}

echo "reduOS onboarding loop"
echo

echo "Sending onboarding support event..."
event_response="$(post_json "/v1/events" '{
  "type": "support.ticket.created",
  "source": "demo:onboarding",
  "severity": "high",
  "user": {
    "email": "founder@example.com",
    "name": "Demo Founder"
  },
  "message": "A customer cannot finish onboarding after selecting a keypair and is asking for help.",
  "metadata": {
    "plan": "startup",
    "area": "onboarding",
    "blocked_step": "create_instance",
    "demo": true
  }
}')"

event_id="$(jq -r '.event_id' <<<"$event_response")"
insight_id="$(jq -r '.insight_id // empty' <<<"$event_response")"

if [ -z "$event_id" ] || [ "$event_id" = "null" ]; then
  echo "Collector did not return an event_id." >&2
  echo "$event_response" | jq .
  exit 1
fi

echo "Recording completed support action..."
action_payload="$(jq -n \
  --arg event_id "$event_id" \
  --arg insight_id "$insight_id" \
  --arg completed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{
    startup_event_id: $event_id,
    action_type: "create_support_task",
    status: "completed",
    target: "activepieces",
    payload: {
      task: "Send onboarding checklist and inspect keypair selection flow",
      assignee: "support"
    },
    result: {
      task_created: true,
      owner_notified: true
    },
    completed_at: $completed_at
  } + if $insight_id == "" then {} else { ai_insight_id: $insight_id } end')"

action_response="$(post_json "/v1/actions" "$action_payload")"
action_id="$(jq -r '.action_id' <<<"$action_response")"

echo "Recording feedback outcome..."
feedback_payload="$(jq -n \
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
      ai_recommendation_used: true,
      demo: true
    }
  }')"

feedback_response="$(post_json "/v1/feedback" "$feedback_payload")"
feedback_id="$(jq -r '.feedback_id' <<<"$feedback_response")"

context_response="$(curl -fsS "${COLLECTOR_URL}/v1/context/similar?type=support.ticket.created&source=demo:onboarding&limit=5" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}")"
context_count="$(jq '.items | length' <<<"$context_response")"

memory_count="unknown"
if [ -n "${QDRANT_API_KEY:-}" ]; then
  memory_count="$(curl -fsS "http://127.0.0.1:6333/collections/${QDRANT_COLLECTION}" \
    -H "api-key: ${QDRANT_API_KEY}" | jq -r '.result.points_count // "unknown"' 2>/dev/null || echo "unknown")"
fi

echo
echo "Event stored:"
jq -r '"  id:        \(.event_id)\n  type:      support.ticket.created\n  customer:  founder@example.com\n  severity:  high"' <<<"$event_response"

echo
echo "AI insight:"
jq -r '.insight |
  "  category:   \(.category)\n  priority:   \(.priority)\n  sentiment:  \(.sentiment)\n  summary:    \(.summary)\n  action:     \(.recommended_action)"' <<<"$event_response"

echo
echo "Memory:"
echo "  stored:    $(jq -r '.memory.stored // false' <<<"$event_response")"
echo "  qdrant:    ${QDRANT_COLLECTION}"
echo "  points:    ${memory_count}"

echo
echo "Action recorded:"
echo "  id:        ${action_id}"
echo "  type:      create_support_task"
echo "  status:    completed"

echo
echo "Feedback recorded:"
echo "  id:        ${feedback_id}"
echo "  result:    resolved"
echo "  score:     1"

echo
echo "Similar context:"
echo "  matches:   ${context_count}"

echo
echo "Open Supabase Studio to inspect rows:"
echo "  ${SUPABASE_STUDIO_URL:-http://127.0.0.1:3000}"
