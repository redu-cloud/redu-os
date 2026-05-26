#!/usr/bin/env bash
# Start the all-in-one local reduOS stack with Supabase, Qdrant, Ollama, and collector.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="${ROOT_DIR}/.local"
SUPABASE_DIR="${LOCAL_DIR}/supabase"
SUPABASE_ENV="${LOCAL_DIR}/supabase-local.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

"${ROOT_DIR}/scripts/supabase-local-bootstrap.sh"

set -a
# shellcheck disable=SC1090
source "$SUPABASE_ENV"
set +a

echo "Starting Supabase..."
cd "$SUPABASE_DIR"
podman-compose --env-file .env down --remove-orphans 2>/dev/null || true
podman-compose --env-file .env pull
podman-compose --env-file .env up -d

echo "Waiting for Supabase REST API..."
for i in $(seq 1 180); do
  if curl -fsS "http://127.0.0.1:${SUPABASE_KONG_HTTP_PORT}/rest/v1/" \
    -H "apikey: ${ANON_KEY}" >/dev/null 2>&1; then
    echo "Supabase REST API is responding."
    break
  fi

  if [ "$i" = "180" ]; then
    echo "Supabase REST API did not become ready in time." >&2
    exit 1
  fi

  sleep 5
done

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

echo "Waiting for PostgREST schema cache..."
for i in $(seq 1 60); do
  if curl -fsS "${SUPABASE_PUBLIC_URL}/rest/v1/startup_events?select=id&limit=1" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" >/dev/null 2>&1; then
    echo "PostgREST schema cache is ready."
    break
  fi

  if [ "$i" = "60" ]; then
    echo "PostgREST schema cache did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

echo "Building and starting collector..."
cd "$ROOT_DIR"
podman-compose -f podman-compose.yml up -d --build

echo "Waiting for Ollama..."
for i in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    echo "Ollama is responding."
    break
  fi

  if [ "$i" = "90" ]; then
    echo "Ollama did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

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

echo "Waiting for Qdrant..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:6333/collections" \
    -H "api-key: ${QDRANT_API_KEY}" >/dev/null 2>&1; then
    echo "Qdrant is responding."
    break
  fi

  if [ "$i" = "60" ]; then
    echo "Qdrant did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

echo "Waiting for collector health..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:3005/health" >/dev/null 2>&1; then
    echo "Collector is responding."
    break
  fi

  if [ "$i" = "60" ]; then
    echo "Collector did not become ready in time." >&2
    exit 1
  fi

  sleep 2
done

"${ROOT_DIR}/scripts/test-local-stack.sh"
"${ROOT_DIR}/scripts/dashboard-auth-setup.sh"
set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

echo
echo "Local reduOS stack is ready:"
echo "  Collector: ${COLLECTOR_URL:-http://127.0.0.1:3005}"
echo "  Dashboard: http://127.0.0.1:${DASHBOARD_PORT:-3006} (run npm run dashboard)"
echo "  Dashboard login: ${DASHBOARD_AUTH_EMAIL} / ${DASHBOARD_AUTH_PASSWORD}"
echo "  Supabase API: ${SUPABASE_PUBLIC_URL}"
echo "  Supabase Studio: ${SUPABASE_STUDIO_URL}"
echo "  Qdrant: http://127.0.0.1:6333"
echo "  Ollama: http://127.0.0.1:${OLLAMA_PORT}"
echo "  Model: ${OLLAMA_MODEL}"
echo "  Studio login: ${DASHBOARD_USERNAME} / ${DASHBOARD_PASSWORD}"
echo "  Local secrets: ${SUPABASE_ENV}"
