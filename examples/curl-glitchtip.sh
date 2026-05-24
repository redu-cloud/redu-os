#!/usr/bin/env bash
set -euo pipefail

COLLECTOR_URL="${COLLECTOR_URL:-http://127.0.0.1:3005}"
COLLECTOR_API_KEY="${COLLECTOR_API_KEY:-change-me-please}"

curl -i -X POST "${COLLECTOR_URL}/v1/events/glitchtip" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "project": "AI OS Demo",
    "level": "error",
    "message": "Checkout API failed",
    "culprit": "POST /api/checkout",
    "event": {
      "event_id": "abc123",
      "release": "v1.0.0",
      "environment": "production"
    }
  }'
