UMAMI_URL="http://127.0.0.1:3000"
UMAMI_PUBLIC_URL="http://YOUR_SERVER_IP_OR_DOMAIN:3000"
UMAMI_USER="admin"
UMAMI_PASS="CHANGE_ME_ADMIN_PASSWORD"

WEBSITE_NAME="reduOS Demo"
WEBSITE_DOMAIN="redu-os.demo"

TOKEN=$(curl -sS -X POST "$UMAMI_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$UMAMI_USER\",\"password\":\"$UMAMI_PASS\"}" \
  | jq -r '.token // .authToken // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed"
  exit 1
fi

CREATE_RESPONSE=$(curl -sS -X POST "$UMAMI_URL/api/websites" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"$WEBSITE_NAME\",\"domain\":\"$WEBSITE_DOMAIN\"}")

WEBSITE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ -z "$WEBSITE_ID" ] || [ "$WEBSITE_ID" = "null" ]; then
  echo "Website creation failed or website already exists."
  echo "$CREATE_RESPONSE" | jq
  exit 1
fi

SNIPPET="<script defer src=\"$UMAMI_PUBLIC_URL/script.js\" data-website-id=\"$WEBSITE_ID\"></script>"

jq -n \
  --arg id "$WEBSITE_ID" \
  --arg name "$WEBSITE_NAME" \
  --arg domain "$WEBSITE_DOMAIN" \
  --arg snippet "$SNIPPET" \
  '{
    success: true,
    website: {
      id: $id,
      name: $name,
      domain: $domain
    },
    snippet: $snippet
  }'
