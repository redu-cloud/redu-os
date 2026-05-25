# GlitchTip Error Tracking

GlitchTip is the optional error tracking module for the modular reduOS stack. It gives the local tier a real Sentry-compatible app for application errors, while the collector keeps a normalized webhook path for AI analysis, memory, and automation.

## Start It

```bash
npm run modular:glitchtip:up
npm run modular:glitchtip:status
```

`modular:glitchtip:up` starts PostgreSQL, Redis, and GlitchTip, runs database migrations, creates the local admin user, and creates the demo organization, team, and project.

Open:

```text
http://127.0.0.1:8001
```

Default local login:

```text
email: admin@example.com
password: ChangeMeStrong123!
```

Default project:

```text
organization: reduOS
team: Default-Team
project: AI-OS-Demo
```

You can override these before the first run:

```env
GLITCHTIP_PORT=8001
GLITCHTIP_ADMIN_EMAIL=admin@example.com
GLITCHTIP_ADMIN_USERNAME=admin
GLITCHTIP_ADMIN_PASSWORD=change-this-password
GLITCHTIP_ORG_NAME=reduOS
GLITCHTIP_TEAM_NAME=Default-Team
GLITCHTIP_PROJECT_NAME=AI-OS-Demo
```

Runtime data is stored in:

```text
.local/glitchtip
```

## Send A reduOS Test Event

The collector already understands GlitchTip/Sentry-style webhook payloads:

```bash
npm run demo:glitchtip
```

This sends an error event through Collector, Supabase, Qdrant memory, local DeepSeek analysis, and configured Activepieces webhooks.

You can also post a minimal event directly:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events/glitchtip \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "event_id": "manual-glitchtip-001",
    "project": "AI-OS-Demo",
    "level": "error",
    "message": "Checkout API returned 500 during onboarding",
    "platform": "node",
    "environment": "production",
    "release": "redu-os@0.1.0",
    "user": {
      "email": "founder@example.com"
    },
    "tags": {
      "area": "checkout",
      "plan": "startup"
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
    "priority": "High"
  }
}
```

## Logs And Stop

```bash
npm run modular:glitchtip:logs
npm run logs:glitchtip
npm run glitchtip:setup
npm run modular:glitchtip:down
```

`glitchtip:setup` is idempotent. Rerun it after changing local GlitchTip admin or project env values.

## Production Notes

- Put GlitchTip behind HTTPS before exposing it publicly.
- Use a strong admin password and a strong `GLITCHTIP_SECRET_KEY`.
- Keep PostgreSQL and Redis storage on persistent disk.
- Configure email before enabling real team invitations or password resets.
- Connect application SDK DSNs in GlitchTip, and point GlitchTip issue webhooks at `POST /v1/events/glitchtip` when you want reduOS analysis.
- Configure backups for `.local/glitchtip/postgres` or your production database.
