# Listmonk Audience

Listmonk is the optional audience and newsletter module for the modular reduOS stack. It gives the local tier a real subscriber/list system for waitlists, beta signups, launches, and customer communication signals.

## Start It

```bash
npm run modular:listmonk:up
npm run modular:listmonk:status
```

`modular:listmonk:up` starts PostgreSQL, starts Listmonk, installs the database schema, creates the local admin user, and creates the demo `Beta-Users` public list.

Open:

```text
http://127.0.0.1:9000
```

Default local login:

```text
username: admin
password: ChangeMeStrong123
```

You can override these before the first run:

```env
LISTMONK_PORT=9000
LISTMONK_URL=http://127.0.0.1:9000
LISTMONK_ADMIN_USERNAME=admin
LISTMONK_ADMIN_PASSWORD=change-this-password
LISTMONK_LIST_NAME=Beta-Users
LISTMONK_LIST_TYPE=public
LISTMONK_LIST_OPTIN=single
LISTMONK_LIST_TAG=waitlist
```

Runtime data is stored in:

```text
.local/listmonk
```

## Send A reduOS Test Event

The collector already understands Listmonk-style audience payloads:

```bash
npm run demo:listmonk
```

This sends a waitlist signup through Collector, Supabase, Qdrant memory, local DeepSeek analysis, and configured Activepieces webhooks.

You can also post directly:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events/listmonk \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "event": "subscriber.created",
    "email": "founder-waitlist@example.com",
    "name": "Waitlist Founder",
    "company": "TinyOps AI",
    "source": "pricing-page",
    "list_name": "Beta Users",
    "list_uuid": "demo-beta-users",
    "attribs": {
      "plan_interest": "startup",
      "team_size": "4"
    }
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
    "category": "growth"
  }
}
```

## Add A Real Subscriber To Listmonk

After setup, the generated list UUID is stored in:

```text
.local/listmonk/list.env
```

Use it with the public subscription endpoint:

```bash
source .local/listmonk/list.env

curl -i -X POST http://127.0.0.1:9000/subscription/form \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=real-subscriber@example.com" \
  --data-urlencode "name=Real Subscriber" \
  --data-urlencode "l=${LISTMONK_LIST_UUID}"
```

## Logs And Stop

```bash
npm run modular:listmonk:logs
npm run logs:listmonk
npm run listmonk:setup
npm run modular:listmonk:down
```

`listmonk:setup` is idempotent. Rerun it after changing local Listmonk admin or list env values.

## Production Notes

- Put Listmonk behind HTTPS before exposing it publicly.
- Use a strong admin password.
- Configure SMTP before sending real campaigns.
- Keep PostgreSQL storage on persistent disk.
- Point Listmonk webhooks or bridge services at `POST /v1/events/listmonk` when you want reduOS analysis.
- Configure backups for `.local/listmonk/postgres` or your production database.
