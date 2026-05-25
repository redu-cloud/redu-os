#!/usr/bin/env bash
# Create/publish local Activepieces use-case flows and connect the collector to them.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run stack:up or npm run modular:local:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/activepieces-env.sh"

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

AP_LOCAL_URL="http://127.0.0.1:${ACTIVEPIECES_PORT:-8080}"
EVENT_API_KEY="${ACTIVEPIECES_EVENT_API_KEY:-}"
DISCORD_WEBHOOK_URL="${ACTIVEPIECES_DISCORD_WEBHOOK_URL:-}"
FORCE_RECREATE="${ACTIVEPIECES_FORCE_RECREATE:-false}"

if [ -z "$EVENT_API_KEY" ] || [[ "$EVENT_API_KEY" == replace-* ]]; then
  echo "ACTIVEPIECES_EVENT_API_KEY was not generated. Run npm run modular:activepieces:up and retry." >&2
  exit 1
fi

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 1
  fi
}

require_tool curl
require_tool jq

set_env() {
  local key="$1"
  local value="$2"

  python3 - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]

lines = path.read_text().splitlines()
out = []
changed = False

for line in lines:
    if line.startswith(key + "=") or line.startswith("#" + key + "="):
        out.append(f"{key}={value}")
        changed = True
    else:
        out.append(line)

if not changed:
    out.append(f"{key}={value}")

path.write_text("\n".join(out) + "\n")
PY
}

echo "Waiting for Activepieces at ${AP_LOCAL_URL}..."
for i in $(seq 1 120); do
  if curl -fsS "${AP_LOCAL_URL}/api/v1/health" >/dev/null 2>&1 || curl -fsS "$AP_LOCAL_URL" >/dev/null 2>&1; then
    break
  fi

  if [ "$i" = "120" ]; then
    echo "Activepieces did not become ready. Start it with npm run modular:activepieces:up." >&2
    exit 1
  fi

  sleep 2
done

echo "Creating or signing in Activepieces owner..."

SIGNUP_RESPONSE="$(curl -sS -X POST "${AP_LOCAL_URL}/api/v1/authentication/sign-up" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg email "${AP_OWNER_EMAIL}" \
    --arg password "${AP_OWNER_PASSWORD}" \
    --arg firstName "${AP_OWNER_FIRST_NAME:-Local}" \
    --arg lastName "${AP_OWNER_LAST_NAME:-Admin}" \
    '{
      email: $email,
      password: $password,
      firstName: $firstName,
      lastName: $lastName,
      trackEvents: false,
      newsLetter: false
    }')" || true)"

TOKEN="$(jq -r '.token // empty' <<<"$SIGNUP_RESPONSE" 2>/dev/null || true)"
PROJECT_ID="$(jq -r '.projectId // empty' <<<"$SIGNUP_RESPONSE" 2>/dev/null || true)"

if [ -z "$TOKEN" ] || [ -z "$PROJECT_ID" ]; then
  SIGNIN_RESPONSE="$(curl -sS -X POST "${AP_LOCAL_URL}/api/v1/authentication/sign-in" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg email "${AP_OWNER_EMAIL}" --arg password "${AP_OWNER_PASSWORD}" \
      '{email: $email, password: $password}')")"

  TOKEN="$(jq -r '.token // empty' <<<"$SIGNIN_RESPONSE")"
  PROJECT_ID="$(jq -r '.projectId // empty' <<<"$SIGNIN_RESPONSE")"
fi

if [ -z "$TOKEN" ] || [ -z "$PROJECT_ID" ]; then
  echo "Could not authenticate to Activepieces as ${AP_OWNER_EMAIL}." >&2
  echo "If you already created a different admin in the UI, update AP_OWNER_EMAIL/AP_OWNER_PASSWORD in .env." >&2
  exit 1
fi

echo "PROJECT_ID=${PROJECT_ID}"

WEBHOOK_VERSION="$(curl -fsS https://registry.npmjs.org/@activepieces%2Fpiece-webhook/latest | jq -r .version || true)"
if [ -z "$WEBHOOK_VERSION" ] || [ "$WEBHOOK_VERSION" = "null" ]; then
  WEBHOOK_VERSION="0.1.33"
fi

flow_id_by_name() {
  local name="$1"

  curl -fsS "${AP_LOCAL_URL}/api/v1/flows?projectId=${PROJECT_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    | jq -r --arg name "$name" '
        .data[]
        | select(.version.displayName == $name or .displayName == $name)
        | .id
      ' | head -n1
}

create_flow() {
  local name="$1"

  local response
  response="$(curl -sS -X POST "${AP_LOCAL_URL}/api/v1/flows" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg displayName "$name" \
      --arg projectId "$PROJECT_ID" \
      '{displayName: $displayName, projectId: $projectId, metadata: {source: "redu-os-local"}}')")"

  jq -r '.id // empty' <<<"$response"
}

ap_operation() {
  local flow_id="$1"
  local file="$2"

  local response
  response="$(curl -sS -w "\nHTTP_STATUS:%{http_code}\n" \
    -X POST "${AP_LOCAL_URL}/api/v1/flows/${flow_id}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary @"$file")"

  local status
  local body
  status="$(awk -F: '/HTTP_STATUS/ {print $2}' <<<"$response" | tr -d ' ')"
  body="$(sed '/HTTP_STATUS:/d' <<<"$response")"

  echo "    $(basename "$file") -> HTTP ${status}"

  if [ "$status" != "200" ] && [ "$status" != "201" ]; then
    echo "$body" | jq . 2>/dev/null || echo "$body"
    exit 1
  fi
}

write_flow_ops() {
  local dir="$1"
  local flow_key="$2"
  local title="$3"
  local matcher="$4"
  local intro="$5"

  jq -n \
    --arg pieceVersion "$WEBHOOK_VERSION" \
    '{
      type: "UPDATE_TRIGGER",
      request: {
        name: "trigger",
        valid: true,
        displayName: "Receive reduOS Event",
        type: "PIECE_TRIGGER",
        settings: {
          pieceName: "@activepieces/piece-webhook",
          pieceVersion: $pieceVersion,
          triggerName: "catch_webhook",
          input: {authType: "none"},
          propertySettings: {}
        }
      }
    }' > "${dir}/01-trigger.json"

  cat > "${dir}/filter-event.js" <<EOF_CODE
exports.code = async (inputs) => {
  const EVENT_API_KEY = '${EVENT_API_KEY}';
  const flowKey = '${flow_key}';
  const title = '${title}';

  const payload = inputs.trigger_payload || {};
  const headers = payload.headers || {};
  const body = payload.body || payload;

  const providedKey =
    headers['x-api-key'] ||
    headers['X-API-Key'] ||
    headers['X-API-KEY'];

  if (EVENT_API_KEY && providedKey !== EVENT_API_KEY) {
    return {
      ok: false,
      matched: false,
      error: 'Invalid API key',
      status: 401
    };
  }

  const event = body.event || {};
  const insight = body.insight || {};

  if (!event.id || !insight.summary) {
    return {
      ok: false,
      matched: false,
      error: 'Expected reduOS payload with event and insight',
      received_keys: Object.keys(body)
    };
  }

  const type = String(event.type || '');
  const source = String(event.source || '');
  const severity = String(event.severity || '').toLowerCase();
  const priority = String(insight.priority || '').toLowerCase();
  const category = String(insight.category || '').toLowerCase();
  const message = String(event.message || '').toLowerCase();
  const metadata = event.metadata || {};

  const matched = (${matcher});

  return {
    ok: true,
    matched,
    skipped: !matched,
    flow_key: flowKey,
    flow_title: title,
    event_id: event.id,
    event_type: type,
    source,
    severity,
    user_email: event.user_email,
    user_name: event.user_name,
    message: event.message,
    metadata,
    category: insight.category,
    priority: insight.priority,
    sentiment: insight.sentiment,
    summary: insight.summary,
    recommended_action: insight.recommended_action
  };
};
EOF_CODE

  local filter_code
  filter_code="$(cat "${dir}/filter-event.js")"

  jq -n \
    --arg code "$filter_code" \
    '{
      type: "ADD_ACTION",
      request: {
        parentStep: "trigger",
        action: {
          name: "filter_reduos_event",
          valid: true,
          displayName: "Filter reduOS Event",
          type: "CODE",
          settings: {
            sourceCode: {packageJson: "{}", code: $code},
            input: {trigger_payload: "{{trigger}}"},
            errorHandlingOptions: {
              retryOnFailure: {value: false},
              continueOnFailure: {value: false}
            }
          }
        }
      }
    }' > "${dir}/02-filter.json"

  cat > "${dir}/build-message.js" <<EOF_CODE
exports.code = async (inputs) => {
  const item = inputs.item;
  const intro = '${intro}';

  if (!item || !item.ok || !item.matched) {
    return {
      ok: true,
      skipped: true,
      reason: item && item.error ? item.error : 'Event did not match this workflow'
    };
  }

  const text =
    '**' + item.flow_title + '**\\n' +
    intro + '\\n\\n' +
    '**Priority:** ' + item.priority + '\\n' +
    '**Category:** ' + item.category + '\\n' +
    '**Sentiment:** ' + item.sentiment + '\\n' +
    '**Source:** ' + item.source + '\\n' +
    '**Event:** ' + item.event_type + '\\n' +
    '**Severity:** ' + item.severity + '\\n\\n' +
    '**Summary:** ' + item.summary + '\\n\\n' +
    '**Recommended action:** ' + item.recommended_action + '\\n\\n' +
    '**Original message:** ' + item.message;

  return {
    ok: true,
    skipped: false,
    handled_by: 'activepieces',
    flow_key: item.flow_key,
    flow_title: item.flow_title,
    event_id: item.event_id,
    event_type: item.event_type,
    priority: item.priority,
    category: item.category,
    sentiment: item.sentiment,
    summary: item.summary,
    recommended_action: item.recommended_action,
    notification_text: text
  };
};
EOF_CODE

  local message_code
  message_code="$(cat "${dir}/build-message.js")"

  jq -n \
    --arg code "$message_code" \
    '{
      type: "ADD_ACTION",
      request: {
        parentStep: "filter_reduos_event",
        action: {
          name: "build_use_case_message",
          valid: true,
          displayName: "Build Use Case Message",
          type: "CODE",
          settings: {
            sourceCode: {packageJson: "{}", code: $code},
            input: {item: "{{filter_reduos_event}}"},
            errorHandlingOptions: {
              retryOnFailure: {value: false},
              continueOnFailure: {value: false}
            }
          }
        }
      }
    }' > "${dir}/03-message.json"

  cat > "${dir}/send-discord.js" <<EOF_CODE
exports.code = async (inputs) => {
  const DISCORD_WEBHOOK_URL = '${DISCORD_WEBHOOK_URL}';
  const result = inputs.result;

  if (!result || result.skipped) {
    return {
      ok: true,
      skipped: true,
      reason: result && result.reason ? result.reason : 'No notification needed'
    };
  }

  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
    return {
      ...result,
      discord_sent: false,
      discord_skipped_reason: 'Discord webhook URL not configured'
    };
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({content: result.notification_text})
    });

    return {
      ...result,
      discord_sent: response.ok,
      discord_status: response.status,
      discord_response: await response.text()
    };
  } catch (error) {
    return {
      ...result,
      discord_sent: false,
      discord_status: 0,
      discord_response: String(error && error.message ? error.message : error)
    };
  }
};
EOF_CODE

  local discord_code
  discord_code="$(cat "${dir}/send-discord.js")"

  jq -n \
    --arg code "$discord_code" \
    '{
      type: "ADD_ACTION",
      request: {
        parentStep: "build_use_case_message",
        action: {
          name: "send_discord_notification",
          valid: true,
          displayName: "Send Discord Notification",
          type: "CODE",
          settings: {
            sourceCode: {packageJson: "{}", code: $code},
            input: {result: "{{build_use_case_message}}"},
            errorHandlingOptions: {
              retryOnFailure: {value: false},
              continueOnFailure: {value: true}
            }
          }
        }
      }
    }' > "${dir}/04-discord.json"

  cat > "${dir}/05-publish.json" <<'EOF'
{
  "type": "LOCK_AND_PUBLISH",
  "request": {}
}
EOF
}

ensure_flow() {
  local name="$1"
  local flow_key="$2"
  local matcher="$3"
  local intro="$4"

  local flow_id
  flow_id="$(flow_id_by_name "$name")"

  if [ -n "$flow_id" ] && [ "$FORCE_RECREATE" != "true" ]; then
    echo "Found existing flow: ${name} (${flow_id})"
    FLOW_IDS+=("$flow_id")
    FLOW_NAMES+=("$name")
    return
  fi

  if [ -n "$flow_id" ] && [ "$FORCE_RECREATE" = "true" ]; then
    echo "Existing flow ${name} (${flow_id}) will be kept; Activepieces API deletion is intentionally not automated."
    echo "Use a new ACTIVEPIECES_FLOW_NAME_PREFIX or delete it in the UI if you want to rebuild from scratch."
    FLOW_IDS+=("$flow_id")
    FLOW_NAMES+=("$name")
    return
  fi

  echo "Creating flow: ${name}"
  flow_id="$(create_flow "$name")"

  if [ -z "$flow_id" ]; then
    echo "Could not create Activepieces flow: ${name}" >&2
    exit 1
  fi

  local work_dir
  work_dir="$(mktemp -d)"
  write_flow_ops "$work_dir" "$flow_key" "$name" "$matcher" "$intro"

  echo "  Adding trigger/actions and publishing..."
  ap_operation "$flow_id" "${work_dir}/01-trigger.json"
  ap_operation "$flow_id" "${work_dir}/02-filter.json"
  ap_operation "$flow_id" "${work_dir}/03-message.json"
  ap_operation "$flow_id" "${work_dir}/04-discord.json"
  ap_operation "$flow_id" "${work_dir}/05-publish.json"
  rm -rf "$work_dir"

  FLOW_IDS+=("$flow_id")
  FLOW_NAMES+=("$name")
}

PREFIX="${ACTIVEPIECES_FLOW_NAME_PREFIX:-reduOS}"
FLOW_IDS=()
FLOW_NAMES=()

ensure_flow "${PREFIX} Support Escalation" \
  "support" \
  "type.includes('support.ticket') || source === 'zammad' || category.includes('support') || (priority === 'high' && message.includes('onboarding'))" \
  "A customer-facing issue needs follow-up."

ensure_flow "${PREFIX} Reliability Incident" \
  "reliability" \
  "type.includes('uptime.monitor.down') || type.includes('error.created') || source === 'glitchtip' || source === 'uptime-kuma' || severity === 'critical'" \
  "A reliability or production health signal needs attention."

ensure_flow "${PREFIX} Product Feedback" \
  "product" \
  "type.includes('feedback') || category.includes('feature') || category.includes('product') || message.includes('feature') || message.includes('confusing')" \
  "Product feedback may deserve a roadmap or UX follow-up."

ensure_flow "${PREFIX} Growth Signal" \
  "growth" \
  "type.includes('analytics') || type.includes('signup') || type.includes('trial') || type.includes('audience.subscriber') || source === 'umami' || source === 'listmonk' || category.includes('sales') || category.includes('growth') || category.includes('audience')" \
  "A signup, trial, analytics, or sales signal was detected."

ensure_flow "${ACTIVEPIECES_FLOW_NAME:-reduOS-Event-Automation}" \
  "generic" \
  "true" \
  "General reduOS automation event."

COLLECTOR_WEBHOOK_URLS=()
for flow_id in "${FLOW_IDS[@]}"; do
  COLLECTOR_WEBHOOK_URLS+=("http://host.containers.internal:${ACTIVEPIECES_PORT:-8080}/api/v1/webhooks/${flow_id}")
done

joined_urls="$(IFS=,; echo "${COLLECTOR_WEBHOOK_URLS[*]}")"
first_url="${COLLECTOR_WEBHOOK_URLS[0]}"

set_env "AUTOMATION_WEBHOOK_URL" "$first_url"
set_env "AUTOMATION_WEBHOOK_URLS" "$joined_urls"
set_env "AUTOMATION_WEBHOOK_API_KEY" "$EVENT_API_KEY"

echo
echo "Activepieces use-case flows are ready:"
for i in "${!FLOW_IDS[@]}"; do
  echo "  ${FLOW_NAMES[$i]}: ${AP_LOCAL_URL}/api/v1/webhooks/${FLOW_IDS[$i]}"
done
echo
echo "Collector automation targets were written to .env."

AUTOMATION_WEBHOOK_URL="$first_url" \
AUTOMATION_WEBHOOK_URLS="$joined_urls" \
AUTOMATION_WEBHOOK_API_KEY="$EVENT_API_KEY" \
"${ROOT_DIR}/scripts/configure-automation-webhook.sh"

echo
echo "Test all use cases with:"
echo "  npm run demo:full"
