#!/usr/bin/env bash
# Create or verify the local Supabase Auth user used by the dashboard.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SUPABASE_ENV="${ROOT_DIR}/.local/supabase-local.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run stack:up or npm run modular:local:up first." >&2
  exit 1
fi

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

get_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true
}

ensure_env() {
  local key="$1"
  local value="$2"
  local current

  current="$(get_env "$key")"
  if [ -z "$current" ] || [[ "$current" == replace-* ]]; then
    set_env "$key" "$value"
  fi
}

ensure_env "DASHBOARD_AUTH_ENABLED" "true"
ensure_env "DASHBOARD_AUTH_EMAIL" "admin@example.com"
ensure_env "DASHBOARD_AUTH_PASSWORD" "ChangeMeStrong123!"
ensure_env "DASHBOARD_SESSION_SECRET" "$(openssl rand -hex 32)"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
if [ -f "$SUPABASE_ENV" ]; then
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
fi
set +a

SUPABASE_AUTH_URL="${SUPABASE_PUBLIC_URL:-${SUPABASE_URL:-http://127.0.0.1:8000}}"
SERVICE_KEY="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
ANON="${ANON_KEY:-}"

if [ -z "$SERVICE_KEY" ] || [ -z "$ANON" ]; then
  echo "Missing Supabase service role or anon key. Start Supabase first." >&2
  exit 1
fi

echo "Creating dashboard Supabase Auth user..."

body="$(jq -n \
  --arg email "$DASHBOARD_AUTH_EMAIL" \
  --arg password "$DASHBOARD_AUTH_PASSWORD" \
  '{
    email: $email,
    password: $password,
    email_confirm: true,
    user_metadata: {
      app: "redu-os-dashboard"
    }
  }')"

post_with_status() {
  local url="$1"
  local api_key="$2"
  local bearer="$3"
  local request_body="$4"

  curl -sS --max-time 30 -w "\nHTTP_STATUS:%{http_code}\n" \
    -X POST "$url" \
    -H "Content-Type: application/json" \
    -H "apikey: ${api_key}" \
    -H "Authorization: Bearer ${bearer}" \
    -d "$request_body" || true
}

should_retry_status() {
  local status="$1"
  [ "$status" = "000" ] || [[ "$status" == 5* ]]
}

response=""
status=""
payload=""

for attempt in $(seq 1 8); do
  response="$(post_with_status "${SUPABASE_AUTH_URL}/auth/v1/admin/users" "$SERVICE_KEY" "$SERVICE_KEY" "$body")"
  status="$(awk -F: '/HTTP_STATUS/ {print $2}' <<<"$response" | tr -d ' ')"
  payload="$(sed '/HTTP_STATUS:/d' <<<"$response")"

  if [ "$status" = "200" ] || [ "$status" = "201" ] || [ "$status" = "422" ]; then
    break
  fi

  if should_retry_status "$status" && [ "$attempt" != "8" ]; then
    echo "Supabase Auth user creation returned HTTP ${status}; retrying in 5s (${attempt}/8)..."
    sleep 5
    continue
  fi

  break
done

if [ "$status" != "200" ] && [ "$status" != "201" ] && [ "$status" != "422" ]; then
  echo "Could not create dashboard auth user." >&2
  echo "$payload" | jq . 2>/dev/null || echo "$payload"
  exit 1
fi

signin_body="$(jq -n --arg email "$DASHBOARD_AUTH_EMAIL" --arg password "$DASHBOARD_AUTH_PASSWORD" \
  '{email: $email, password: $password}')"

signin_response=""
signin_status=""
signin_payload=""

for attempt in $(seq 1 8); do
  signin_response="$(post_with_status "${SUPABASE_AUTH_URL}/auth/v1/token?grant_type=password" "$ANON" "$ANON" "$signin_body")"
  signin_status="$(awk -F: '/HTTP_STATUS/ {print $2}' <<<"$signin_response" | tr -d ' ')"
  signin_payload="$(sed '/HTTP_STATUS:/d' <<<"$signin_response")"

  if [ "$signin_status" = "200" ]; then
    break
  fi

  if should_retry_status "$signin_status" && [ "$attempt" != "8" ]; then
    echo "Dashboard auth sign-in check returned HTTP ${signin_status}; retrying in 5s (${attempt}/8)..."
    sleep 5
    continue
  fi

  break
done

if [ "$signin_status" != "200" ]; then
  echo "Dashboard auth user exists but sign-in failed." >&2
  echo "$signin_payload" | jq . 2>/dev/null || echo "$signin_payload"
  exit 1
fi

echo "Dashboard auth is ready:"
echo "  URL: http://127.0.0.1:${DASHBOARD_PORT:-3006}"
echo "  Email: ${DASHBOARD_AUTH_EMAIL}"
echo "  Password: ${DASHBOARD_AUTH_PASSWORD}"
