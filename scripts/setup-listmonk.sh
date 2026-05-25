#!/usr/bin/env bash
# Install Listmonk DB and create the local demo list.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
INSTALL_MARKER="${ROOT_DIR}/.local/listmonk/.installed"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:listmonk:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/listmonk-env.sh" >/dev/null

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

LISTMONK_URL="${LISTMONK_URL:-http://127.0.0.1:9000}"
LISTMONK_ADMIN_USERNAME="${LISTMONK_ADMIN_USERNAME:-admin}"
LISTMONK_ADMIN_PASSWORD="${LISTMONK_ADMIN_PASSWORD:-ChangeMeStrong123}"
LISTMONK_LIST_NAME="${LISTMONK_LIST_NAME:-Beta-Users}"
LISTMONK_LIST_TYPE="${LISTMONK_LIST_TYPE:-public}"
LISTMONK_LIST_OPTIN="${LISTMONK_LIST_OPTIN:-single}"
LISTMONK_LIST_TAG="${LISTMONK_LIST_TAG:-waitlist}"
LISTMONK_IMAGE="${LISTMONK_IMAGE:-docker.io/listmonk/listmonk:latest}"

sql_literal() {
  python3 - "$1" <<'PY'
import sys

print("'" + sys.argv[1].replace("'", "''") + "'")
PY
}

if ! command -v jq >/dev/null 2>&1; then
  echo "Missing required command: jq" >&2
  exit 1
fi

if ! podman container exists redu-os-listmonk-postgres 2>/dev/null; then
  echo "Listmonk Postgres container is not present. Run npm run modular:listmonk:up first." >&2
  exit 1
fi

echo "Waiting for Listmonk Postgres..."
for attempt in $(seq 1 90); do
  if podman exec redu-os-listmonk-postgres pg_isready \
    -U "${LISTMONK_POSTGRES_USERNAME:-listmonk}" \
    -d "${LISTMONK_POSTGRES_DATABASE:-listmonk}" >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" = "90" ]; then
    echo "Listmonk Postgres did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

if [ ! -f "$INSTALL_MARKER" ]; then
  echo "Installing Listmonk database..."
  if podman run --rm \
    --network compose_default \
    -e LISTMONK_ADMIN_USER="$LISTMONK_ADMIN_USERNAME" \
    -e LISTMONK_ADMIN_PASSWORD="$LISTMONK_ADMIN_PASSWORD" \
    -v "${ROOT_DIR}/.local/listmonk/config.toml:/listmonk/config.toml:ro" \
    "$LISTMONK_IMAGE" \
    sh -c './listmonk --install --yes --config /listmonk/config.toml'; then
    touch "$INSTALL_MARKER"
  else
    echo "Listmonk install command failed; checking whether the app is already installed..." >&2
  fi
fi

if ! podman container exists redu-os-listmonk 2>/dev/null; then
  echo "Listmonk database install is ready. Start the Listmonk app, then rerun setup to create the demo list."
  exit 0
fi

echo "Waiting for Listmonk web..."
for attempt in $(seq 1 90); do
  if curl -fsS "$LISTMONK_URL" >/dev/null 2>&1; then
    break
  fi

  if [ "$attempt" = "90" ]; then
    echo "Listmonk web did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

echo "Creating or verifying Listmonk demo list..."
list_name_sql="$(sql_literal "$LISTMONK_LIST_NAME")"
list_uuid="$(podman exec redu-os-listmonk-postgres \
  psql -U "${LISTMONK_POSTGRES_USERNAME:-listmonk}" \
    -d "${LISTMONK_POSTGRES_DATABASE:-listmonk}" \
    -tAc "SELECT uuid FROM lists WHERE name = ${list_name_sql} ORDER BY id LIMIT 1;" \
  2>/dev/null | tr -d '[:space:]' || true)"

if [ -n "$list_uuid" ] && [ "$list_uuid" != "null" ]; then
  echo "Listmonk list already exists: ${LISTMONK_LIST_NAME}"
else
  create_response="$(curl -fsS -X POST "${LISTMONK_URL}/api/lists" \
    -u "${LISTMONK_ADMIN_USERNAME}:${LISTMONK_ADMIN_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg name "$LISTMONK_LIST_NAME" \
      --arg type "$LISTMONK_LIST_TYPE" \
      --arg optin "$LISTMONK_LIST_OPTIN" \
      --arg tag "$LISTMONK_LIST_TAG" \
      '{name: $name, type: $type, optin: $optin, tags: [$tag]}')" 2>/dev/null || true)"

  list_uuid="$(jq -r '.data.uuid // .uuid // empty' <<<"$create_response" 2>/dev/null || true)"

  if [ -n "$list_uuid" ]; then
    echo "Created Listmonk list: ${LISTMONK_LIST_NAME}"
  else
    echo "Could not create or find Listmonk list." >&2
    echo "$create_response" | jq . 2>/dev/null || echo "$create_response"
    exit 1
  fi
fi

echo "LISTMONK_LIST_UUID=${list_uuid}" > "${ROOT_DIR}/.local/listmonk/list.env"

echo "Listmonk is ready:"
echo "  URL: ${LISTMONK_URL}"
echo "  Username: ${LISTMONK_ADMIN_USERNAME}"
echo "  Password: ${LISTMONK_ADMIN_PASSWORD}"
echo "  List: ${LISTMONK_LIST_NAME}"
echo "  List UUID: ${list_uuid}"
