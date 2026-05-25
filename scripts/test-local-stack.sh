#!/usr/bin/env bash
# Smoke test collector, Supabase, Qdrant, Ollama, and schema connectivity.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_ENV="${ROOT_DIR}/.local/supabase-local.env"

if [ -f "$SUPABASE_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
  set +a
fi

COLLECTOR_URL="${COLLECTOR_URL:-http://127.0.0.1:3005}"
COLLECTOR_API_KEY="${COLLECTOR_API_KEY:-change-me-please}"
QDRANT_COLLECTION="${QDRANT_COLLECTION:-redu_os_events}"
OLLAMA_PORT="${OLLAMA_PORT:-11435}"

echo "Testing collector health..."
curl -fsS "${COLLECTOR_URL}/health" >/dev/null

echo "Testing Qdrant health..."
curl -fsS "http://127.0.0.1:6333/collections" \
  -H "api-key: ${QDRANT_API_KEY}" >/dev/null

echo "Testing Ollama health..."
curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null

echo "Posting a test event through the collector..."
for i in $(seq 1 30); do
  if curl -fsS -X POST "${COLLECTOR_URL}/v1/events" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${COLLECTOR_API_KEY}" \
    -d '{
      "type": "local.stack.test",
      "source": "supabase-local",
      "severity": "info",
      "user": {
        "email": "founder@example.com",
        "name": "Demo Founder"
      },
      "message": "Local Supabase and the reduOS collector are connected.",
      "metadata": {
        "script": "scripts/test-local-stack.sh"
      }
    }' >/dev/null; then
    echo "Local stack smoke test passed."
    curl -fsS "http://127.0.0.1:6333/collections/${QDRANT_COLLECTION}" \
      -H "api-key: ${QDRANT_API_KEY}" >/dev/null
    echo "Qdrant memory collection is ready."
    exit 0
  fi

  if [ "$i" = "30" ]; then
    echo "Local stack smoke test failed." >&2
    exit 1
  fi

  sleep 2
done
