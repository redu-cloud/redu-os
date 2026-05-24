curl -sS -X POST "http://127.0.0.1:${FIRECRAWL_BRIDGE_PORT}/api/scrape" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${FIRECRAWL_BRIDGE_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"],
    "timeout": 60000
  }' | jq
