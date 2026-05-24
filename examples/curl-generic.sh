#!/usr/bin/env bash
set -euo pipefail

COLLECTOR_URL="${COLLECTOR_URL:-http://127.0.0.1:3005}"
COLLECTOR_API_KEY="${COLLECTOR_API_KEY:-change-me-please}"

curl -i -X POST "${COLLECTOR_URL}/v1/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "type": "product.feedback",
    "source": "demo",
    "severity": "medium",
    "user": {
      "email": "founder@example.com",
      "name": "Demo Founder"
    },
    "message": "I want my AI OS to understand support tickets, product events, and production errors.",
    "metadata": {
      "stack": "redu-cloud-ai-os"
    }
  }'
