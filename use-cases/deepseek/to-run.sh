curl -X POST "http://REPLACE_WITH_VM_IP:3001/api/generate" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "prompt": "Explain what cloud-init is in 3 short bullets."
  }'
