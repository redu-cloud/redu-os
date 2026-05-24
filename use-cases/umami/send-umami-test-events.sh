#!/usr/bin/env bash
set -euo pipefail

UMAMI_URL="${UMAMI_URL:-http://127.0.0.1:3000}"
UMAMI_USER="${UMAMI_USER:-admin}"
UMAMI_PASS="${UMAMI_PASS:-umami}"

TOKEN=$(curl -sS -X POST "$UMAMI_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$UMAMI_USER\",\"password\":\"$UMAMI_PASS\"}" \
  | jq -r '.token // .authToken // empty')

WEBSITE_ID=$(curl -sS "$UMAMI_URL/api/websites" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[0].id')

echo "WEBSITE_ID=$WEBSITE_ID"

send_event() {
  local url="$1"
  local title="$2"
  local name="$3"
  local data="$4"

  curl -sS -X POST "$UMAMI_URL/api/send" \
    -H "Content-Type: application/json" \
    -H "User-Agent: reduOS-test" \
    -d "{
      \"type\": \"event\",
      \"payload\": {
        \"website\": \"$WEBSITE_ID\",
        \"hostname\": \"redu-os.demo\",
        \"language\": \"en-US\",
        \"referrer\": \"https://redu.cloud\",
        \"screen\": \"1920x1080\",
        \"title\": \"$title\",
        \"url\": \"$url\",
        \"name\": \"$name\",
        \"data\": $data
      }
    }"

  echo ""
}

send_event "/" "reduOS Landing" "visit_landing" '{"source":"curl","app":"reduOS"}'
send_event "/dashboard" "reduOS Dashboard" "open_dashboard" '{"source":"curl","app":"reduOS"}'
send_event "/operator" "reduOS Operator" "ask_operator" '{"prompt":"What happened today?","source":"curl"}'
send_event "/stack" "reduOS Stack" "view_stack" '{"source":"curl","app":"reduOS"}'
send_event "/actions" "reduOS Actions" "view_actions" '{"source":"curl","app":"reduOS"}'

echo "Done. Wait 5-10 seconds, then query metrics."
EOF
