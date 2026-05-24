#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3005}"
API_KEY="${COLLECTOR_API_KEY:-change-me-please}"

curl -sS "$BASE_URL/v1/context/similar?type=support.ticket.created&source=zammad&limit=5" \
  -H "X-API-Key: $API_KEY"
