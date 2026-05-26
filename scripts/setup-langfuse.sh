#!/usr/bin/env bash
# Wait for local Langfuse and verify the seeded project API keys.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env. Run npm run modular:langfuse:up first." >&2
  exit 1
fi

"${ROOT_DIR}/scripts/langfuse-env.sh" >/dev/null

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

LANGFUSE_URL="${LANGFUSE_URL:-http://127.0.0.1:3007}"
LANGFUSE_PUBLIC_KEY="${LANGFUSE_PUBLIC_KEY:-}"
LANGFUSE_SECRET_KEY="${LANGFUSE_SECRET_KEY:-}"

if [ -z "$LANGFUSE_PUBLIC_KEY" ] || [ -z "$LANGFUSE_SECRET_KEY" ]; then
  echo "LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are required." >&2
  exit 1
fi

echo "Waiting for Langfuse at ${LANGFUSE_URL}..."
for _ in $(seq 1 120); do
  if curl -fsS "${LANGFUSE_URL}/api/public/projects" \
    -u "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" >/dev/null 2>&1; then
    echo "Langfuse is ready."
    echo "  URL: ${LANGFUSE_URL}"
    echo "  Login: ${LANGFUSE_ADMIN_EMAIL:-admin@example.com} / ${LANGFUSE_ADMIN_PASSWORD:-ChangeMeStrong123}"
    echo "  Project: ${LANGFUSE_INIT_PROJECT_NAME:-reduOS-AI}"
    echo "  Collector tracing: LANGFUSE_ENABLED=${LANGFUSE_ENABLED:-true}"
    exit 0
  fi
  sleep 3
done

echo "Langfuse did not become ready in time. Check logs with npm run logs:langfuse." >&2
exit 1
