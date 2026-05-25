# Activepieces Automation

reduOS can trigger any webhook-compatible automation service. For a proper local Activepieces module, this repo runs Activepieces with PostgreSQL and Redis.

Official Activepieces guidance:

```text
Single-container Docker is for personal/testing.
Docker Compose with PostgreSQL and Redis is the proper path for production or multi-instance setups.
```

## Start Activepieces

```bash
npm run modular:activepieces:up
npm run activepieces:setup
```

This starts:

```text
redu-os-activepieces
redu-os-activepieces-postgres   # PostgreSQL 16 with pgvector
redu-os-activepieces-redis
```

Open:

```text
http://127.0.0.1:8080
```

Status and logs:

```bash
npm run modular:activepieces:status
npm run modular:activepieces:logs
```

Stop:

```bash
npm run modular:activepieces:down
```

## Configure A Flow

The setup command automates flow creation using the same API approach as `use-cases/activepieces/cloud-init.sh`. It:

```text
1. Creates or signs in the local owner user.
2. Creates prebuilt reduOS use-case flows if they do not exist.
3. Adds a Webhook trigger to each flow.
4. Adds a filter code step per use case.
5. Adds a message-building code step.
6. Adds an optional Discord notification code step.
7. Publishes each flow.
8. Points the collector at all generated webhook URLs.
```

Created flows:

```text
reduOS Support Escalation
reduOS Reliability Incident
reduOS Product Feedback
reduOS Growth Signal
reduOS-Event-Automation
```

Then test it:

```bash
npm run demo:full
```

Or use the local dashboard:

```bash
npm run dashboard:auth:setup
npm run dashboard
```

Open `http://127.0.0.1:3006` and sign in with the dashboard Supabase Auth user from `.env`.

Manual flow wiring still works if you want to use a custom flow. For same-machine reduOS, a copied URL that starts with:

```text
http://127.0.0.1:8080/...
```

must be converted for the collector container:

```text
http://host.containers.internal:8080/...
```

## Enable Custom Collector Automation

Use a custom webhook URL:

```bash
AUTOMATION_WEBHOOK_URL="http://host.containers.internal:8080/YOUR_ACTIVEPIECES_WEBHOOK_PATH" \
AUTOMATION_WEBHOOK_URLS="http://host.containers.internal:8080/YOUR_ACTIVEPIECES_WEBHOOK_PATH" \
AUTOMATION_WEBHOOK_API_KEY="" \
npm run automation:enable
```

This writes the webhook URL/key into `.env` and recreates the collector so the new automation target is loaded.

Then run:

```bash
npm run demo:onboarding
```

Expected collector response:

```json
{
  "automation": {
    "sent": true,
    "targets": 5,
    "results": []
  },
  "action_id": "uuid"
}
```

Supabase should also contain an `ai_actions` row:

```text
action_type: trigger_automation_webhook
status: completed
target: activepieces
```

## Environment

`npm run modular:activepieces:up` generates missing Activepieces secrets into `.env`:

```env
ACTIVEPIECES_PORT=8080
AP_FRONTEND_URL=http://127.0.0.1:8080
AP_ENCRYPTION_KEY=...
AP_JWT_SECRET=...
AP_POSTGRES_DATABASE=activepieces
AP_POSTGRES_USERNAME=activepieces
AP_POSTGRES_PASSWORD=...
AP_EXECUTION_MODE=UNSANDBOXED
AP_CONTAINER_TYPE=WORKER_AND_APP
AP_TELEMETRY_ENABLED=false
AP_PIECES_SYNC_MODE=OFFICIAL_AUTO
AP_OWNER_EMAIL=admin@example.com
AP_OWNER_FIRST_NAME=Local
AP_OWNER_LAST_NAME=Admin
AP_OWNER_PASSWORD=ChangeMeStrong123
ACTIVEPIECES_FLOW_NAME=reduOS-Event-Automation
ACTIVEPIECES_FLOW_NAME_PREFIX=reduOS
ACTIVEPIECES_EVENT_API_KEY=...
ACTIVEPIECES_DISCORD_WEBHOOK_URL=
```

Keep these values shell-safe because local scripts source `.env`. Avoid unquoted spaces in values.

Generated data is stored in:

```text
.local/activepieces/postgres
.local/activepieces/redis
```

The PostgreSQL container uses the official pgvector Postgres image so Activepieces can enable its vector-backed knowledge-base tables when it initializes.

## Notes

For a public or production-style deployment:

```text
Set AP_FRONTEND_URL to the public HTTPS URL.
Protect Activepieces behind HTTPS.
Use strong generated AP_ENCRYPTION_KEY and AP_JWT_SECRET values.
Back up the Activepieces PostgreSQL volume.
Keep the collector and Activepieces on a private network when possible.
```
