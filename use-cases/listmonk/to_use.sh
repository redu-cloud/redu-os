curl -X POST "http://REPLACE_WITH_VM_IP:3001/api/signup" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "name": "Milos",
    "email": "milos@example.com",
    "company": "redu.cloud",
    "source": "api-demo"
  }'
