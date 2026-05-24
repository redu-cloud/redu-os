curl -X POST "http://REPLACE_WITH_VM_IP:3001/api/ticket" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "name": "Milos",
    "email": "milos@example.com",
    "title": "Server is down",
    "message": "My server is down and I need help."
  }'
