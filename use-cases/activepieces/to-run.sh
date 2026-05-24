AP_URL="http://YOUR_SERVER_PUBLIC_IP:8080"
AP_EMAIL="admin@example.com"
AP_PASSWORD="ChangeMeStrong123"
EVENT_API_KEY="YOUR_EVENT_API_KEY_HERE"
FLOW_NAME="Startup Feedback AI"

TOKEN_AND_PROJECT="$(curl -sS -X POST "$AP_URL/api/v1/authentication/sign-in" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$AP_EMAIL\",
    \"password\": \"$AP_PASSWORD\"
  }")"

TOKEN="$(echo "$TOKEN_AND_PROJECT" | jq -r '.token')"
PROJECT_ID="$(echo "$TOKEN_AND_PROJECT" | jq -r '.projectId')"

FLOW_ID="$(curl -sS "$AP_URL/api/v1/flows?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r --arg name "$FLOW_NAME" '
      .data[]
      | select(.version.displayName == $name or .displayName == $name)
      | .id
    ' | head -n1)"

echo "PROJECT_ID=$PROJECT_ID"
echo "FLOW_ID=$FLOW_ID"
echo "WEBHOOK_URL=$AP_URL/api/v1/webhooks/$FLOW_ID"

curl -i -X POST "$AP_URL/api/v1/webhooks/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $EVENT_API_KEY" \
  -d '{
    "type": "startup_feedback",
    "source": "external-test",
    "user": "Milos",
    "email": "founder@example.com",
    "message": "External test: user clicked deploy but got confused by the API key step."
  }'
