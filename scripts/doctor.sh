#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_ENV="${ROOT_DIR}/.local/supabase-local.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/podman-env.sh"

FAILURES=0
WARNINGS=0

ok() {
  printf "  %-24s ok  %s\n" "$1" "${2:-}"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf "  %-24s warn  %s\n" "$1" "$2"
}

fail() {
  FAILURES=$((FAILURES + 1))
  printf "  %-24s fail  %s\n" "$1" "$2"
}

info() {
  printf "  %-24s info  %s\n" "$1" "$2"
}

version_of() {
  case "$1" in
    node) node --version 2>/dev/null ;;
    npm) npm --version 2>/dev/null ;;
    podman) podman --version 2>/dev/null ;;
    podman-compose) podman-compose --version 2>/dev/null | head -n1 ;;
    jq) jq --version 2>/dev/null ;;
    curl) curl --version 2>/dev/null | head -n1 ;;
    git) git --version 2>/dev/null ;;
    rsync) rsync --version 2>/dev/null | head -n1 ;;
    openssl) openssl version 2>/dev/null ;;
    python3) python3 --version 2>/dev/null ;;
    *) "$1" --version 2>/dev/null | head -n1 ;;
  esac
}

check_cmd() {
  local cmd="$1"

  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$cmd" "$(version_of "$cmd")"
  else
    fail "$cmd" "missing"
  fi
}

port_open() {
  local port="$1"
  (echo >"/dev/tcp/127.0.0.1/${port}") >/dev/null 2>&1
}

check_port() {
  local port="$1"
  local label="$2"

  if port_open "$port"; then
    ok "$label" "127.0.0.1:${port} listening"
  else
    warn "$label" "127.0.0.1:${port} is not listening"
  fi
}

http_ok() {
  curl -fsS "$@" >/dev/null 2>&1
}

check_container() {
  local name="$1"

  if ! command -v podman >/dev/null 2>&1; then
    warn "$name" "podman unavailable"
    return
  fi

  local state
  state="$(podman inspect -f '{{.State.Status}}' "$name" 2>/dev/null || true)"

  if [ "$state" = "running" ]; then
    ok "$name" "running"
  elif [ -n "$state" ]; then
    warn "$name" "$state"
  else
    warn "$name" "not found"
  fi
}

check_table() {
  local table="$1"

  if [ -z "${SERVICE_ROLE_KEY:-}" ]; then
    warn "$table" "SERVICE_ROLE_KEY unavailable"
    return
  fi

  if http_ok "http://127.0.0.1:8000/rest/v1/${table}?select=id&limit=1" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"; then
    ok "$table" "queryable"
  else
    fail "$table" "not queryable"
  fi
}

echo "reduOS doctor"
echo

echo "Tools:"
for cmd in node npm jq curl git rsync openssl python3 podman podman-compose; do
  check_cmd "$cmd"
done

echo
echo "Local files:"
if [ -f "${ROOT_DIR}/.env" ]; then
  ok ".env" "present"
else
  warn ".env" "missing; run npm run stack:up"
fi

if [ -f "$SUPABASE_ENV" ]; then
  ok ".local/supabase-local.env" "present"
  set -a
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
  set +a
else
  warn ".local/supabase-local.env" "missing; run npm run stack:up"
fi

if [ -d "${ROOT_DIR}/.git" ]; then
  if find "${ROOT_DIR}/.git" ! -user "$(id -un)" -maxdepth 3 -print -quit 2>/dev/null | grep -q .; then
    warn ".git ownership" "some Git internals are not owned by $(id -un)"
  else
    ok ".git ownership" "owned by $(id -un)"
  fi
fi

echo
echo "Ports:"
check_port 3000 "Supabase Studio"
check_port 3005 "Collector"
check_port 6333 "Qdrant REST"
check_port 6334 "Qdrant gRPC"
check_port 8000 "Supabase API"
check_port 8443 "Supabase HTTPS"
check_port "${OLLAMA_PORT:-11435}" "Ollama"

echo
echo "Containers:"
check_container redu-os-collector
check_container redu-os-qdrant
check_container redu-os-ollama
check_container supabase-db
check_container supabase-kong
check_container supabase-studio

echo
echo "Services:"
if http_ok http://127.0.0.1:3005/health; then
  ok "collector health" "http://127.0.0.1:3005/health"
else
  fail "collector health" "not responding"
fi

if http_ok "http://127.0.0.1:${OLLAMA_PORT:-11435}/api/tags"; then
  ok "ollama api" "responding"
else
  fail "ollama api" "not responding"
fi

if [ -n "${QDRANT_API_KEY:-}" ] && http_ok http://127.0.0.1:6333/collections -H "api-key: ${QDRANT_API_KEY}"; then
  ok "qdrant api" "responding"
else
  fail "qdrant api" "not responding or QDRANT_API_KEY missing"
fi

if [ -n "${ANON_KEY:-}" ] && http_ok http://127.0.0.1:8000/rest/v1/ -H "apikey: ${ANON_KEY}"; then
  ok "supabase rest" "responding"
else
  fail "supabase rest" "not responding or ANON_KEY missing"
fi

echo
echo "Models:"
if command -v jq >/dev/null 2>&1 && http_ok "http://127.0.0.1:${OLLAMA_PORT:-11435}/api/tags"; then
  models="$(curl -fsS "http://127.0.0.1:${OLLAMA_PORT:-11435}/api/tags" 2>/dev/null || echo '{"models":[]}')"

  if jq -e --arg model "${OLLAMA_MODEL:-deepseek-r1:1.5b}" 'any(.models[].name; startswith($model))' >/dev/null 2>&1 <<<"$models"; then
    ok "${OLLAMA_MODEL:-deepseek-r1:1.5b}" "available"
  else
    warn "${OLLAMA_MODEL:-deepseek-r1:1.5b}" "missing; run npm run stack:up"
  fi

  if jq -e --arg model "${OLLAMA_EMBED_MODEL:-nomic-embed-text}" 'any(.models[].name; startswith($model))' >/dev/null 2>&1 <<<"$models"; then
    ok "${OLLAMA_EMBED_MODEL:-nomic-embed-text}" "available"
  else
    warn "${OLLAMA_EMBED_MODEL:-nomic-embed-text}" "missing; run npm run stack:up"
  fi
else
  warn "ollama models" "could not inspect"
fi

echo
echo "Data:"
if [ -n "${QDRANT_API_KEY:-}" ] && command -v jq >/dev/null 2>&1; then
  qdrant_collection="$(curl -fsS "http://127.0.0.1:6333/collections/${QDRANT_COLLECTION:-redu_os_events}" \
    -H "api-key: ${QDRANT_API_KEY}" 2>/dev/null || true)"

  if [ -n "$qdrant_collection" ]; then
    points="$(jq -r '.result.points_count // 0' <<<"$qdrant_collection")"
    ok "${QDRANT_COLLECTION:-redu_os_events}" "${points} points"
  else
    warn "${QDRANT_COLLECTION:-redu_os_events}" "collection not found"
  fi
else
  warn "qdrant collection" "could not inspect"
fi

check_table startup_events
check_table ai_insights
check_table ai_actions
check_table ai_feedback

echo
if [ "$FAILURES" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo "Doctor passed. Local reduOS stack looks healthy."
  exit 0
fi

if [ "$FAILURES" -eq 0 ]; then
  echo "Doctor completed with ${WARNINGS} warning(s)."
  exit 0
fi

echo "Doctor found ${FAILURES} failure(s) and ${WARNINGS} warning(s)."
exit 1
