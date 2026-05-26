#!/usr/bin/env bash
# Start the same-machine modular stack using separate compose files per service.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="${ROOT_DIR}/.local"
SUPABASE_DIR="${LOCAL_DIR}/supabase"
SUPABASE_ENV="${LOCAL_DIR}/supabase-local.env"
COMPOSE_DIR="${ROOT_DIR}/compose"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

wait_for() {
  local label="$1"
  local attempts="$2"
  local sleep_seconds="$3"
  shift 3

  echo "Waiting for ${label}..."
  for i in $(seq 1 "$attempts"); do
    if "$@" >/dev/null 2>&1; then
      echo "${label} is responding."
      return 0
    fi

    if [ "$i" = "$attempts" ]; then
      echo "${label} did not become ready in time." >&2
      return 1
    fi

    sleep "$sleep_seconds"
  done
}

"${ROOT_DIR}/scripts/supabase-local-bootstrap.sh"
"${ROOT_DIR}/scripts/activepieces-env.sh"
if [ -f "${ROOT_DIR}/.local/langfuse-local.env" ]; then
  "${ROOT_DIR}/scripts/langfuse-env.sh"
fi

set -a
# shellcheck disable=SC1090
source "$SUPABASE_ENV"
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

echo "Stopping combined local collector/Qdrant/Ollama stack if present..."
cd "$ROOT_DIR"
podman-compose -f podman-compose.yml down 2>/dev/null || true

echo "Starting Supabase..."
cd "$SUPABASE_DIR"
podman-compose --env-file .env down --remove-orphans 2>/dev/null || true
podman-compose --env-file .env pull
podman-compose --env-file .env up -d

wait_for "Supabase REST API" 180 5 \
  curl -fsS "http://127.0.0.1:${SUPABASE_KONG_HTTP_PORT}/rest/v1/" \
  -H "apikey: ${ANON_KEY}"

echo "Applying reduOS schema to Supabase..."
DB_CONTAINER="$(podman ps --format '{{.Names}}' | grep -E '^supabase-db$' | head -n1 || true)"
if [ -z "$DB_CONTAINER" ]; then
  echo "Could not find supabase-db container." >&2
  podman ps -a
  exit 1
fi

podman cp "${ROOT_DIR}/sql/schema.sql" "${DB_CONTAINER}:/tmp/redu-os-schema.sql"
podman exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "$DB_CONTAINER" \
  psql -U postgres -d "${POSTGRES_DB}" -f /tmp/redu-os-schema.sql

wait_for "PostgREST schema cache" 60 2 \
  curl -fsS "${SUPABASE_PUBLIC_URL}/rest/v1/startup_events?select=id&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"

echo "Starting modular Qdrant..."
cd "$COMPOSE_DIR"
podman-compose -f qdrant.yml up -d

echo "Starting modular Ollama..."
podman-compose -f ollama.yml up -d

wait_for "Ollama" 90 2 \
  curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/tags"

echo "Pulling DeepSeek chat model..."
for i in $(seq 1 5); do
  if podman exec redu-os-ollama ollama pull "${OLLAMA_MODEL}"; then
    break
  fi

  if [ "$i" = "5" ]; then
    echo "DeepSeek model pull failed." >&2
    exit 1
  fi

  sleep 30
done

echo "Pulling embedding model..."
for i in $(seq 1 5); do
  if podman exec redu-os-ollama ollama pull "${OLLAMA_EMBED_MODEL}"; then
    break
  fi

  if [ "$i" = "5" ]; then
    echo "Embedding model pull failed." >&2
    exit 1
  fi

  sleep 30
done

echo "Testing embedding model..."
EMBED_SIZE="$(curl -fsS -X POST "http://127.0.0.1:${OLLAMA_PORT}/api/embeddings" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${OLLAMA_EMBED_MODEL}\",
    \"prompt\": \"startup pricing concern\"
  }" | jq -r '.embedding | length // 0' 2>/dev/null || echo 0)"

if [ "$EMBED_SIZE" != "768" ]; then
  echo "Expected ${OLLAMA_EMBED_MODEL} to return 768-dimensional embeddings, got ${EMBED_SIZE}." >&2
  exit 1
fi

wait_for "Qdrant" 60 2 \
  curl -fsS "http://127.0.0.1:${QDRANT_REST_PORT:-6333}/collections" \
  -H "api-key: ${QDRANT_API_KEY}"

echo "Building and starting modular collector..."
podman-compose -f collector.yml -f collector.same-machine.yml up -d --build

wait_for "collector health" 60 2 \
  curl -fsS "http://127.0.0.1:${COLLECTOR_PORT:-3005}/health"

"${ROOT_DIR}/scripts/test-local-stack.sh"
"${ROOT_DIR}/scripts/dashboard-auth-setup.sh"
set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

echo
echo "Same-machine modular reduOS stack is ready:"
echo "  Collector: http://127.0.0.1:${COLLECTOR_PORT:-3005}"
echo "  Dashboard: http://127.0.0.1:${DASHBOARD_PORT:-3006} (run npm run dashboard)"
echo "  Dashboard login: ${DASHBOARD_AUTH_EMAIL} / ${DASHBOARD_AUTH_PASSWORD}"
echo "  Supabase API: ${SUPABASE_PUBLIC_URL}"
echo "  Supabase Studio: ${SUPABASE_STUDIO_URL}"
echo "  Qdrant: http://127.0.0.1:${QDRANT_REST_PORT:-6333}"
echo "  Ollama: http://127.0.0.1:${OLLAMA_PORT}"
echo "  Model: ${OLLAMA_MODEL}"
echo "  Studio login: ${DASHBOARD_USERNAME} / ${DASHBOARD_PASSWORD}"
echo "  Activepieces: ${AP_FRONTEND_URL:-http://127.0.0.1:${ACTIVEPIECES_PORT:-8080}}"
echo "  Activepieces login: ${AP_OWNER_EMAIL} / ${AP_OWNER_PASSWORD}"
echo "  Activepieces setup: npm run modular:activepieces:up && npm run activepieces:setup"
echo "  Uptime Kuma: npm run modular:uptime:up"
echo "  Uptime Kuma login: ${UPTIME_KUMA_ADMIN_USERNAME:-admin} / ${UPTIME_KUMA_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  Umami: npm run modular:umami:up"
echo "  Umami login: ${UMAMI_ADMIN_USERNAME:-admin} / ${UMAMI_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  GlitchTip: npm run modular:glitchtip:up"
echo "  GlitchTip login: ${GLITCHTIP_ADMIN_EMAIL:-admin@example.com} / ${GLITCHTIP_ADMIN_PASSWORD:-ChangeMeStrong123!}"
echo "  Listmonk: npm run modular:listmonk:up"
echo "  Listmonk login: ${LISTMONK_ADMIN_USERNAME:-admin} / ${LISTMONK_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  Zammad: npm run modular:zammad:up"
echo "  Zammad login: ${ZAMMAD_ADMIN_EMAIL:-admin@example.com} / ${ZAMMAD_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  Langfuse: npm run modular:langfuse:up"
echo "  Langfuse login: ${LANGFUSE_ADMIN_EMAIL:-admin@example.com} / ${LANGFUSE_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  Local secrets: ${SUPABASE_ENV}"
echo "  Project env: ${ROOT_DIR}/.env"
