#!/usr/bin/env bash
# Create or verify the local Umami admin account and demo website.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:umami:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/umami-env.sh" >/dev/null

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

UMAMI_URL="${UMAMI_URL:-http://127.0.0.1:3002}"
UMAMI_ADMIN_USERNAME="${UMAMI_ADMIN_USERNAME:-admin}"
UMAMI_OLD_ADMIN_PASSWORD="${UMAMI_OLD_ADMIN_PASSWORD:-umami}"
UMAMI_ADMIN_PASSWORD="${UMAMI_ADMIN_PASSWORD:-ChangeMeStrong123}"
UMAMI_WEBSITE_NAME="${UMAMI_WEBSITE_NAME:-reduOS Demo}"
UMAMI_WEBSITE_DOMAIN="${UMAMI_WEBSITE_DOMAIN:-redu-os.local}"

if ! command -v jq >/dev/null 2>&1; then
  echo "Missing required command: jq" >&2
  exit 1
fi

login_umami() {
  local password="$1"
  curl -fsS -X POST "${UMAMI_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg username "$UMAMI_ADMIN_USERNAME" --arg password "$password" \
      '{username: $username, password: $password}')" 2>/dev/null || true
}

extract_token() {
  jq -r '.token // .authToken // empty'
}

echo "Waiting for Umami..."
for attempt in $(seq 1 120); do
  if curl -fsS "$UMAMI_URL" >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" = "120" ]; then
    echo "Umami did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

echo "Creating or verifying Umami admin and demo website..."

login_response="$(login_umami "$UMAMI_ADMIN_PASSWORD")"
token="$(extract_token <<<"$login_response")"
using_old_password=false

if [ -z "$token" ]; then
  login_response="$(login_umami "$UMAMI_OLD_ADMIN_PASSWORD")"
  token="$(extract_token <<<"$login_response")"
  using_old_password=true
fi

if [ -z "$token" ]; then
  echo "Could not sign into Umami with configured or default credentials." >&2
  echo "$login_response" | jq . 2>/dev/null || echo "$login_response"
  exit 1
fi

websites_response="$(curl -fsS "${UMAMI_URL}/api/websites" \
  -H "Authorization: Bearer ${token}")"
website_id="$(jq -r --arg name "$UMAMI_WEBSITE_NAME" '.data[]? | select(.name == $name) | .id' <<<"$websites_response" | head -n1)"
user_id="$(jq -r --arg name "$UMAMI_WEBSITE_NAME" '.data[]? | select(.name == $name) | .userId' <<<"$websites_response" | head -n1)"

if [ -n "$website_id" ]; then
  echo "Umami website already exists: ${UMAMI_WEBSITE_NAME}"
else
  create_response="$(curl -fsS -X POST "${UMAMI_URL}/api/websites" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${token}" \
    -d "$(jq -n --arg name "$UMAMI_WEBSITE_NAME" --arg domain "$UMAMI_WEBSITE_DOMAIN" \
      '{name: $name, domain: $domain}')" 2>/dev/null || true)"

  website_id="$(jq -r '.id // .website.id // empty' <<<"$create_response" 2>/dev/null || true)"
  user_id="$(jq -r '.userId // .website.userId // empty' <<<"$create_response" 2>/dev/null || true)"

  if [ -n "$website_id" ]; then
    echo "Created Umami website: ${UMAMI_WEBSITE_NAME}"
  else
    echo "Could not create or find Umami website." >&2
    echo "$create_response" | jq . 2>/dev/null || echo "$create_response"
    exit 1
  fi
fi

if [ "$using_old_password" = "true" ] && [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
  update_response="$(curl -fsS -X POST "${UMAMI_URL}/api/users/${user_id}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${token}" \
    -d "$(jq -n --arg username "$UMAMI_ADMIN_USERNAME" --arg password "$UMAMI_ADMIN_PASSWORD" \
      '{username: $username, password: $password, role: "admin"}')" 2>/dev/null || true)"

  new_login_response="$(login_umami "$UMAMI_ADMIN_PASSWORD")"
  new_token="$(extract_token <<<"$new_login_response")"
  if [ -n "$new_token" ]; then
    echo "Umami admin password updated."
    token="$new_token"
  else
    echo "Umami admin password update could not be confirmed." >&2
    echo "$update_response" | jq . 2>/dev/null || echo "$update_response"
  fi
fi

snippet="<script defer src=\"${UMAMI_URL}/script.js\" data-website-id=\"${website_id}\"></script>"

echo "Umami is ready:"
echo "  URL: ${UMAMI_URL}"
echo "  Username: ${UMAMI_ADMIN_USERNAME}"
echo "  Password: ${UMAMI_ADMIN_PASSWORD}"
echo "  Website: ${UMAMI_WEBSITE_NAME}"
echo "  Website ID: ${website_id}"
echo "  Tracking snippet: ${snippet}"
