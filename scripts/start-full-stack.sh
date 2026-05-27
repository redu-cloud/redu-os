#!/usr/bin/env bash
# Full reduOS stack: Supabase, Qdrant, Ollama, Collector, LiteLLM, LangGraph, Activepieces, Dashboard.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="${ROOT_DIR}/.local"
SUPABASE_DIR="${LOCAL_DIR}/supabase"
SUPABASE_ENV="${LOCAL_DIR}/supabase-local.env"
COMPOSE_DIR="${ROOT_DIR}/compose"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

wait_for() {
  local label="$1" attempts="$2" sleep_sec="$3"
  shift 3
  echo "Waiting for ${label}..."
  for i in $(seq 1 "$attempts"); do
    if "$@" >/dev/null 2>&1; then
      echo "${label} is ready."
      return 0
    fi
    [ "$i" = "$attempts" ] && { echo "${label} did not become ready in time." >&2; return 1; }
    sleep "$sleep_sec"
  done
}

wait_for_optional() {
  local label="$1" attempts="$2" sleep_sec="$3"
  shift 3
  echo "Waiting for ${label}..."
  for i in $(seq 1 "$attempts"); do
    if "$@" >/dev/null 2>&1; then
      echo "${label} is ready."
      return 0
    fi
    sleep "$sleep_sec"
  done
  echo "${label} is not responding yet — continuing. Check: npm run logs:${label,,}"
  return 0
}

section() { echo; echo "==> $*"; }

# ---------------------------------------------------------------------------
# Generate / refresh all env secrets (idempotent — reuses existing keys)
# ---------------------------------------------------------------------------

section "Bootstrapping env secrets"
"${ROOT_DIR}/scripts/supabase-local-bootstrap.sh"
"${ROOT_DIR}/scripts/activepieces-env.sh"
# LiteLLM must run before LangGraph — LangGraph reads LiteLLM keys to wire its AI provider
"${ROOT_DIR}/scripts/litellm-env.sh"
"${ROOT_DIR}/scripts/langgraph-env.sh"
# Optional modules — idempotent, safe to call every run
"${ROOT_DIR}/scripts/langfuse-env.sh"
"${ROOT_DIR}/scripts/uptime-env.sh"
"${ROOT_DIR}/scripts/umami-env.sh"
"${ROOT_DIR}/scripts/glitchtip-env.sh"
"${ROOT_DIR}/scripts/listmonk-env.sh"
"${ROOT_DIR}/scripts/zammad-env.sh"

set -a
# shellcheck disable=SC1090
source "$SUPABASE_ENV"
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# Tear down any legacy single-compose stack
# ---------------------------------------------------------------------------

echo "Stopping legacy combined stack if present..."
cd "$ROOT_DIR"
podman-compose -f podman-compose.yml down 2>/dev/null || true

# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------

section "Starting Supabase"
cd "$SUPABASE_DIR"
podman-compose --env-file .env down --remove-orphans 2>/dev/null || true
podman-compose --env-file .env pull
podman-compose --env-file .env up -d

wait_for "Supabase REST API" 180 5 \
  curl -fsS "http://127.0.0.1:${SUPABASE_KONG_HTTP_PORT}/rest/v1/" \
  -H "apikey: ${ANON_KEY}"

echo "Applying reduOS schema..."
DB_CONTAINER="$(podman ps --format '{{.Names}}' | grep -E '^supabase-db$' | head -n1 || true)"
if [ -z "$DB_CONTAINER" ]; then
  echo "Could not find supabase-db container." >&2; podman ps -a; exit 1
fi
podman cp "${ROOT_DIR}/sql/schema.sql" "${DB_CONTAINER}:/tmp/redu-os-schema.sql"
podman exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "$DB_CONTAINER" \
  psql -U postgres -d "${POSTGRES_DB}" -f /tmp/redu-os-schema.sql

wait_for "PostgREST schema cache" 60 2 \
  curl -fsS "${SUPABASE_PUBLIC_URL}/rest/v1/startup_events?select=id&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"

# ---------------------------------------------------------------------------
# Qdrant + Ollama
# ---------------------------------------------------------------------------

section "Starting Qdrant and Ollama"
cd "$COMPOSE_DIR"
podman-compose -f qdrant.yml up -d
podman-compose -f ollama.yml up -d

wait_for "Ollama" 90 2 \
  curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/tags"

echo "Pulling DeepSeek chat model..."
for i in $(seq 1 5); do
  podman exec redu-os-ollama ollama pull "${OLLAMA_MODEL}" && break
  [ "$i" = "5" ] && { echo "DeepSeek model pull failed." >&2; exit 1; }
  sleep 30
done

echo "Pulling embedding model..."
for i in $(seq 1 5); do
  podman exec redu-os-ollama ollama pull "${OLLAMA_EMBED_MODEL}" && break
  [ "$i" = "5" ] && { echo "Embedding model pull failed." >&2; exit 1; }
  sleep 30
done

echo "Testing embedding model..."
EMBED_SIZE="$(curl -fsS -X POST "http://127.0.0.1:${OLLAMA_PORT}/api/embeddings" \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"${OLLAMA_EMBED_MODEL}\", \"prompt\": \"startup pricing concern\"}" \
  | jq -r '.embedding | length // 0' 2>/dev/null || echo 0)"

if [ "$EMBED_SIZE" != "768" ]; then
  echo "Expected ${OLLAMA_EMBED_MODEL} to return 768-dim embeddings, got ${EMBED_SIZE}." >&2
  exit 1
fi

wait_for "Qdrant" 60 2 \
  curl -fsS "http://127.0.0.1:${QDRANT_REST_PORT:-6333}/collections" \
  -H "api-key: ${QDRANT_API_KEY}"

# ---------------------------------------------------------------------------
# Collector
# ---------------------------------------------------------------------------

section "Building and starting Collector"
cd "$COMPOSE_DIR"
podman-compose -f collector.yml -f collector.same-machine.yml up -d --build

wait_for "Collector" 60 2 \
  curl -fsS "http://127.0.0.1:${COLLECTOR_PORT:-3005}/health"

"${ROOT_DIR}/scripts/test-local-stack.sh"
"${ROOT_DIR}/scripts/dashboard-auth-setup.sh"

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# LiteLLM
# ---------------------------------------------------------------------------

section "Starting LiteLLM AI gateway"
cd "$COMPOSE_DIR"
podman-compose -f litellm.yml up -d

wait_for_optional "LiteLLM" 60 5 \
  curl -s "http://127.0.0.1:${LITELLM_PORT:-4000}/" -o /dev/null

# ---------------------------------------------------------------------------
# LangGraph
# ---------------------------------------------------------------------------

section "Building and starting LangGraph agent service"
cd "$COMPOSE_DIR"
podman-compose -f langgraph.yml up -d --build

wait_for_optional "LangGraph" 120 5 \
  curl -s "http://127.0.0.1:${LANGGRAPH_PORT:-3010}/health" -o /dev/null

# ---------------------------------------------------------------------------
# Activepieces
# ---------------------------------------------------------------------------

section "Starting Activepieces automation"
cd "$COMPOSE_DIR"

# Always start Activepieces clean — volumes are rebuilt by setup-activepieces-flow.sh.
# Use podman unshare to remove root-owned Postgres/Redis data dirs without sudo.
echo "Resetting Activepieces volumes..."
podman-compose -f activepieces.yml down 2>/dev/null || true
podman unshare rm -rf \
  "${LOCAL_DIR}/activepieces/postgres" \
  "${LOCAL_DIR}/activepieces/redis" 2>/dev/null \
  || rm -rf \
    "${LOCAL_DIR}/activepieces/postgres" \
    "${LOCAL_DIR}/activepieces/redis" 2>/dev/null \
  || true

podman-compose -f activepieces.yml up -d

wait_for "Activepieces" 90 5 \
  curl -s "http://127.0.0.1:${ACTIVEPIECES_PORT:-8080}" -o /dev/null

echo "Setting up Activepieces flows..."
"${ROOT_DIR}/scripts/setup-activepieces-flow.sh"

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# Langfuse (LLM tracing)
# ---------------------------------------------------------------------------

section "Starting Langfuse LLM tracing"
cd "$COMPOSE_DIR"
podman-compose -f langfuse.yml up -d

wait_for_optional "Langfuse" 60 5 \
  curl -fsS "http://127.0.0.1:${LANGFUSE_PORT:-3007}/" -o /dev/null

"${ROOT_DIR}/scripts/setup-langfuse.sh" || echo "Langfuse setup skipped (already configured or not ready)"

# Restart collector so Langfuse tracing env vars are picked up
echo "Restarting collector with Langfuse tracing enabled..."
podman-compose -f collector.yml -f collector.same-machine.yml up -d --build

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# Uptime Kuma (uptime monitoring)
# ---------------------------------------------------------------------------

section "Starting Uptime Kuma"
cd "$COMPOSE_DIR"
echo "Resetting Uptime Kuma database volume..."
podman-compose -f uptime.yml down 2>/dev/null || true
podman unshare rm -rf "${LOCAL_DIR}/uptime-kuma/mariadb" 2>/dev/null \
  || rm -rf "${LOCAL_DIR}/uptime-kuma/mariadb" 2>/dev/null || true
podman-compose -f uptime.yml up -d

wait_for_optional "Uptime Kuma" 60 3 \
  curl -fsS "http://127.0.0.1:${UPTIME_KUMA_PORT:-3001}/" -o /dev/null

"${ROOT_DIR}/scripts/setup-uptime-kuma.sh" || echo "Uptime Kuma setup skipped (already configured or not ready)"

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# Umami (analytics)
# ---------------------------------------------------------------------------

section "Starting Umami analytics"
cd "$COMPOSE_DIR"
echo "Resetting Umami database volume..."
podman-compose -f umami.yml down 2>/dev/null || true
podman unshare rm -rf "${LOCAL_DIR}/umami/postgres" 2>/dev/null \
  || rm -rf "${LOCAL_DIR}/umami/postgres" 2>/dev/null || true
podman-compose -f umami.yml up -d

wait_for_optional "Umami" 90 5 \
  curl -fsS "http://127.0.0.1:${UMAMI_PORT:-3002}/api/auth/login" -o /dev/null

"${ROOT_DIR}/scripts/setup-umami.sh" || echo "Umami setup skipped (already configured or not ready)"

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# GlitchTip (error tracking)
# ---------------------------------------------------------------------------

section "Starting GlitchTip error tracking"
cd "$COMPOSE_DIR"
echo "Resetting GlitchTip database volumes..."
podman-compose -f glitchtip.yml down 2>/dev/null || true
podman unshare rm -rf "${LOCAL_DIR}/glitchtip/postgres" "${LOCAL_DIR}/glitchtip/redis" 2>/dev/null \
  || rm -rf "${LOCAL_DIR}/glitchtip/postgres" "${LOCAL_DIR}/glitchtip/redis" 2>/dev/null || true
podman-compose -f glitchtip.yml up -d

wait_for_optional "GlitchTip" 120 5 \
  curl -fsS "http://127.0.0.1:${GLITCHTIP_PORT:-8001}/" -o /dev/null

"${ROOT_DIR}/scripts/setup-glitchtip.sh" || echo "GlitchTip setup skipped (already configured or not ready)"

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# Listmonk (email / newsletter)
# ---------------------------------------------------------------------------

section "Starting Listmonk email"
cd "$COMPOSE_DIR"
echo "Resetting Listmonk database volume..."
podman-compose -f listmonk.yml down 2>/dev/null || true
podman unshare rm -rf "${LOCAL_DIR}/listmonk/postgres" 2>/dev/null \
  || rm -rf "${LOCAL_DIR}/listmonk/postgres" 2>/dev/null || true
rm -f "${LOCAL_DIR}/listmonk/.installed"
podman-compose -f listmonk.yml up -d listmonk-postgres
"${ROOT_DIR}/scripts/setup-listmonk.sh" || echo "Listmonk DB setup skipped (already configured or not ready)"
podman-compose -f listmonk.yml up -d listmonk

wait_for_optional "Listmonk" 60 3 \
  curl -fsS "http://127.0.0.1:${LISTMONK_PORT:-9000}/" -o /dev/null

"${ROOT_DIR}/scripts/setup-listmonk.sh" || echo "Listmonk setup skipped (already configured or not ready)"

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# Zammad (support / ticketing)
# ---------------------------------------------------------------------------

section "Starting Zammad support portal"
"${ROOT_DIR}/scripts/zammad-env.sh"

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

cd "${ROOT_DIR}/.local/zammad"
zammad_compose=(-f docker-compose.yml)
if [ "${ELASTICSEARCH_ENABLED:-false}" = "false" ]; then
  zammad_compose+=(-f scenarios/disable-elasticsearch-service.yml)
fi
podman-compose --env-file .env "${zammad_compose[@]}" up -d

"${ROOT_DIR}/scripts/setup-zammad.sh" || echo "Zammad setup skipped (already configured or not ready)"

wait_for_optional "Zammad" 120 5 \
  curl -fsS "http://127.0.0.1:${ZAMMAD_PORT:-8081}/" -o /dev/null

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env"
set +a

# ---------------------------------------------------------------------------
# Dashboard (Podman container)
# ---------------------------------------------------------------------------

section "Starting Dashboard"
cd "$ROOT_DIR"

# Kill any stale tsx dashboard process left over from older versions
if [ -f "${LOCAL_DIR}/dashboard.pid" ]; then
  old_pid="$(cat "${LOCAL_DIR}/dashboard.pid" 2>/dev/null || true)"
  if [ -n "$old_pid" ]; then kill "$old_pid" 2>/dev/null || true; fi
  rm -f "${LOCAL_DIR}/dashboard.pid"
fi

podman-compose -f "${COMPOSE_DIR}/dashboard.yml" up -d --build

wait_for_optional "Dashboard" 60 3 \
  curl -fsS "http://127.0.0.1:${DASHBOARD_PORT:-3006}/login"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo
echo "================================================================"
echo "  reduOS full stack is ready"
echo "================================================================"
echo
echo "  Collector:       http://127.0.0.1:${COLLECTOR_PORT:-3005}"
echo "  Dashboard:       http://127.0.0.1:${DASHBOARD_PORT:-3006}"
echo "    login:         ${DASHBOARD_AUTH_EMAIL} / ${DASHBOARD_AUTH_PASSWORD}"
echo
echo "  Supabase API:    ${SUPABASE_PUBLIC_URL}"
echo "  Supabase Studio: ${SUPABASE_STUDIO_URL}"
echo "    login:         ${DASHBOARD_USERNAME} / ${DASHBOARD_PASSWORD}"
echo "  Qdrant:          http://127.0.0.1:${QDRANT_REST_PORT:-6333}"
echo "  Ollama:          http://127.0.0.1:${OLLAMA_PORT}  (model: ${OLLAMA_MODEL})"
echo
echo "  LiteLLM:         ${LITELLM_URL:-http://127.0.0.1:${LITELLM_PORT:-4000}}"
echo "    UI / key:      ${LITELLM_URL:-http://127.0.0.1:${LITELLM_PORT:-4000}}/ui  /  ${LITELLM_MASTER_KEY}"
echo "  LangGraph:       ${LANGGRAPH_URL:-http://127.0.0.1:${LANGGRAPH_PORT:-3010}}"
echo "    key:           ${LANGGRAPH_API_KEY}"
echo "  Activepieces:    ${AP_FRONTEND_URL:-http://127.0.0.1:${ACTIVEPIECES_PORT:-8080}}"
echo "    login:         ${AP_OWNER_EMAIL} / ${AP_OWNER_PASSWORD}"
echo "    webhook key:   ${AUTOMATION_WEBHOOK_API_KEY}"
echo
echo "  Dashboard logs:  npm run logs:dashboard"
echo
echo "  Langfuse:        http://127.0.0.1:${LANGFUSE_PORT:-3007}"
echo "    login:         ${LANGFUSE_ADMIN_EMAIL:-admin@example.com} / ${LANGFUSE_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  Uptime Kuma:     http://127.0.0.1:${UPTIME_KUMA_PORT:-3001}"
echo "    login:         ${UPTIME_KUMA_ADMIN_USERNAME:-admin} / ${UPTIME_KUMA_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  Umami:           http://127.0.0.1:${UMAMI_PORT:-3002}"
echo "    login:         ${UMAMI_ADMIN_USERNAME:-admin} / ${UMAMI_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  GlitchTip:       http://127.0.0.1:${GLITCHTIP_PORT:-8001}"
echo "    login:         ${GLITCHTIP_ADMIN_EMAIL:-admin@example.com} / ${GLITCHTIP_ADMIN_PASSWORD:-ChangeMeStrong123!}"
echo "  Listmonk:        http://127.0.0.1:${LISTMONK_PORT:-9000}"
echo "    login:         ${LISTMONK_ADMIN_USERNAME:-admin} / ${LISTMONK_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo "  Zammad:          http://127.0.0.1:${ZAMMAD_PORT:-8081}"
echo "    login:         ${ZAMMAD_ADMIN_EMAIL:-admin@example.com} / ${ZAMMAD_ADMIN_PASSWORD:-ChangeMeStrong123}"
echo
echo "  Try it:"
echo "    npm run demo:full"
echo "    npm run demo:langgraph"
echo "================================================================"
