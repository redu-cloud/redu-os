#!/usr/bin/env bash
# Send support, reliability, product, and growth demo events through collector.
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

post_event() {
  local label="$1"
  local payload="$2"

  echo
  echo "Sending ${label}..."

  local response
  response="$(curl -fsS -X POST "${COLLECTOR_URL}/v1/events" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${COLLECTOR_API_KEY}" \
    -d "$payload")"

  jq -r --arg label "$label" '
    "  label:      \($label)\n" +
    "  event_id:   \(.event_id)\n" +
    "  action_id:  \(.action_id // "none")\n" +
    "  automation: \(
      if .automation.sent == true then
        "sent to " + ((.automation.targets // 1) | tostring) + " target(s)"
      else
        (.automation.reason // .automation.error // "not sent")
      end
    )\n" +
    "  insight:    \(.insight.priority) / \(.insight.category)\n" +
    "  summary:    \(.insight.summary)"
  ' <<<"$response"
}

echo "reduOS full use-case demo"
echo "Collector: ${COLLECTOR_URL}"

post_event "support escalation" '{
  "type": "support.ticket.created",
  "source": "demo:full",
  "severity": "high",
  "user": {
    "email": "founder@example.com",
    "name": "Demo Founder"
  },
  "message": "A paid customer cannot finish onboarding after selecting a keypair and is asking for urgent help.",
  "metadata": {
    "plan": "startup",
    "area": "onboarding",
    "blocked_step": "create_instance",
    "demo": true
  }
}'

post_event "reliability incident" '{
  "type": "uptime.monitor.down",
  "source": "uptime-kuma",
  "severity": "critical",
  "message": "Production API health check is down for 3 minutes. Checkout and dashboard requests are failing.",
  "metadata": {
    "monitor_name": "production-api",
    "monitor_url": "https://api.example.com/health",
    "demo": true
  }
}'

echo
echo "Sending Uptime Kuma monitor alert..."
uptime_response="$(curl -fsS -X POST "${COLLECTOR_URL}/v1/events/uptime-kuma" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "monitor": {
      "name": "Production API",
      "url": "https://api.example.com/health"
    },
    "heartbeat": {
      "status": 0,
      "msg": "timeout after 10 seconds",
      "time": "2026-05-25T16:30:00Z"
    }
  }')"

jq -r '
  "  label:      uptime kuma alert\n" +
  "  event_id:   \(.event_id)\n" +
  "  action_id:  \(.action_id // "none")\n" +
  "  automation: \(
    if .automation.sent == true then
      "sent to " + ((.automation.targets // 1) | tostring) + " target(s)"
    else
      (.automation.reason // .automation.error // "not sent")
    end
  )\n" +
  "  insight:    \(.insight.priority) / \(.insight.category)\n" +
  "  summary:    \(.insight.summary)"
' <<<"$uptime_response"

echo
echo "Sending GlitchTip production error..."
glitchtip_response="$(curl -fsS -X POST "${COLLECTOR_URL}/v1/events/glitchtip" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "project_name": "AI OS Demo",
    "level": "error",
    "culprit": "POST /api/checkout",
    "event": {
      "title": "Checkout API failed",
      "transaction": "POST /api/checkout",
      "release": "v1.0.0",
      "environment": "production",
      "request": {
        "method": "POST",
        "url": "https://app.example.com/api/checkout"
      },
      "user": {
        "email": "buyer@example.com",
        "name": "Demo Buyer"
      },
      "exception": {
        "values": [
          {
            "type": "PaymentProviderTimeout",
            "value": "Stripe request timed out after 10 seconds"
          }
        ]
      }
    }
  }')"

jq -r '
  "  label:      glitchtip error\n" +
  "  event_id:   \(.event_id)\n" +
  "  action_id:  \(.action_id // "none")\n" +
  "  automation: \(
    if .automation.sent == true then
      "sent to " + ((.automation.targets // 1) | tostring) + " target(s)"
    else
      (.automation.reason // .automation.error // "not sent")
    end
  )\n" +
  "  insight:    \(.insight.priority) / \(.insight.category)\n" +
  "  summary:    \(.insight.summary)"
' <<<"$glitchtip_response"

post_event "product feedback" '{
  "type": "product.feedback.created",
  "source": "demo:full",
  "severity": "medium",
  "user": {
    "email": "beta@example.com",
    "name": "Beta User"
  },
  "message": "The deployment page is confusing. I expected the keypair and security group steps to be explained before launch.",
  "metadata": {
    "area": "deployments",
    "feedback_channel": "in-app",
    "demo": true
  }
}'

post_event "growth signal" '{
  "type": "signup.trial.created",
  "source": "umami",
  "severity": "info",
  "user": {
    "email": "ops-lead@example.com",
    "name": "Ops Lead"
  },
  "message": "New trial signup from a startup operations lead who visited pricing, docs, and the deployment template page.",
  "metadata": {
    "company_size": "12",
    "visited_pages": ["pricing", "docs", "templates"],
    "demo": true
  }
}'

echo
echo "Sending Umami analytics event..."
umami_response="$(curl -fsS -X POST "${COLLECTOR_URL}/v1/events/umami" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "type": "event",
    "payload": {
      "website": "demo-website-id",
      "hostname": "redu-os.demo",
      "referrer": "https://redu.cloud/pricing",
      "title": "reduOS Dashboard",
      "url": "/onboarding/create-instance",
      "name": "onboarding_abandoned",
      "data": {
        "email": "founder@example.com",
        "name": "Demo Founder",
        "plan": "startup",
        "step": "create_instance",
        "source": "full-demo"
      }
    }
  }')"

jq -r '
  "  label:      umami analytics\n" +
  "  event_id:   \(.event_id)\n" +
  "  action_id:  \(.action_id // "none")\n" +
  "  automation: \(
    if .automation.sent == true then
      "sent to " + ((.automation.targets // 1) | tostring) + " target(s)"
    else
      (.automation.reason // .automation.error // "not sent")
    end
  )\n" +
  "  insight:    \(.insight.priority) / \(.insight.category)\n" +
  "  summary:    \(.insight.summary)"
' <<<"$umami_response"

echo
echo "Sending Zammad support ticket..."
zammad_response="$(curl -fsS -X POST "${COLLECTOR_URL}/v1/events/zammad" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "name": "Milos Demo",
    "email": "milos@example.com",
    "title": "Server is down",
    "message": "My production server is down after a deploy and I need help quickly.",
    "priority": "high"
  }')"

jq -r '
  "  label:      zammad ticket\n" +
  "  event_id:   \(.event_id)\n" +
  "  action_id:  \(.action_id // "none")\n" +
  "  automation: \(
    if .automation.sent == true then
      "sent to " + ((.automation.targets // 1) | tostring) + " target(s)"
    else
      (.automation.reason // .automation.error // "not sent")
    end
  )\n" +
  "  insight:    \(.insight.priority) / \(.insight.category)\n" +
  "  summary:    \(.insight.summary)"
' <<<"$zammad_response"

echo
echo "Sending Listmonk audience signal..."
listmonk_response="$(curl -fsS -X POST "${COLLECTOR_URL}/v1/events/listmonk" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "event": "subscriber.created",
    "email": "founder-waitlist@example.com",
    "name": "Waitlist Founder",
    "company": "TinyOps AI",
    "source": "pricing-page",
    "list_name": "Beta Users",
    "list_uuid": "demo-beta-users",
    "attribs": {
      "plan_interest": "startup",
      "team_size": "4"
    }
  }')"

jq -r '
  "  label:      listmonk audience\n" +
  "  event_id:   \(.event_id)\n" +
  "  action_id:  \(.action_id // "none")\n" +
  "  automation: \(
    if .automation.sent == true then
      "sent to " + ((.automation.targets // 1) | tostring) + " target(s)"
    else
      (.automation.reason // .automation.error // "not sent")
    end
  )\n" +
  "  insight:    \(.insight.priority) / \(.insight.category)\n" +
  "  summary:    \(.insight.summary)"
' <<<"$listmonk_response"

echo
echo "Full demo complete."
echo "Open Supabase Studio: ${SUPABASE_STUDIO_URL:-http://127.0.0.1:3000}"
echo "Open Activepieces: ${AP_FRONTEND_URL:-http://127.0.0.1:${ACTIVEPIECES_PORT:-8080}}"
