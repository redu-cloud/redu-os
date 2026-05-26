# Zammad Support

Zammad is the optional support/helpdesk module for the modular reduOS stack. It is heavier than Uptime Kuma, Umami, GlitchTip, or Listmonk, so it is not part of the smallest tier. Use it when you want a real ticketing UI behind the collector's Zammad support-event path.

This module uses the official `zammad-docker-compose` repository at runtime. The generated compose bundle lives in:

```text
.local/zammad
```

## Start It

```bash
npm run modular:zammad:up
npm run modular:zammad:status
```

`modular:zammad:up` fetches the official Zammad compose files, writes local env overrides, starts Zammad, waits for Rails, and creates/updates the local admin user.

Open:

```text
http://127.0.0.1:8081
```

Default local login:

```text
email: admin@example.com
password: ChangeMeStrong123
```

You can override these before the first run:

```env
ZAMMAD_PORT=8081
ZAMMAD_URL=http://127.0.0.1:8081
ZAMMAD_ADMIN_EMAIL=admin@example.com
ZAMMAD_ADMIN_PASSWORD=change-this-password
ZAMMAD_ADMIN_FIRSTNAME=Local
ZAMMAD_ADMIN_LASTNAME=Admin
ZAMMAD_ORGANIZATION=reduOS-Support
```

## Send A reduOS Test Event

The collector already understands Zammad-style support-ticket payloads:

```bash
npm run demo:zammad
```

This sends a support ticket event through Collector, Supabase, Qdrant memory, local DeepSeek analysis, and configured Activepieces webhooks.

You can also post directly:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events/zammad \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "name": "Milos Demo",
    "email": "milos@example.com",
    "title": "Server is down",
    "message": "My production server is down after a deploy and I need help quickly.",
    "priority": "high"
  }' | jq
```

Expected collector result:

```json
{
  "ok": true,
  "stored": true,
  "memory": {
    "stored": true
  },
  "insight": {
    "priority": "High"
  }
}
```

## Create A Real Zammad Ticket

After Zammad is ready, use the Zammad API directly:

```bash
curl -sS -X POST http://127.0.0.1:8081/api/v1/tickets \
  -u "${ZAMMAD_ADMIN_EMAIL:-admin@example.com}:${ZAMMAD_ADMIN_PASSWORD:-ChangeMeStrong123}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Customer cannot finish onboarding",
    "group": "Users",
    "customer_id": "guess:customer@example.com",
    "article": {
      "subject": "Customer cannot finish onboarding",
      "body": "The customer is blocked at the billing step and needs help.",
      "type": "web",
      "internal": false
    }
  }' | jq
```

## Logs And Stop

```bash
npm run modular:zammad:logs
npm run logs:zammad
npm run zammad:setup
npm run modular:zammad:down
```

`zammad:setup` is idempotent. Rerun it after changing local admin env values.

## Production Notes

- Zammad is a heavier optional module. Plan more RAM and disk than the smallest reduOS tier.
- Put Zammad behind HTTPS before exposing it publicly.
- Use a strong admin password.
- Keep the official runtime compose bundle in `.local/zammad`; do not commit it.
- Back up the Zammad PostgreSQL volume if tickets matter.
- Point Zammad webhooks or bridge services at `POST /v1/events/zammad` when you want reduOS analysis.
