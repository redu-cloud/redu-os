# Integration Webhooks

This guide connects the real local modules to the reduOS collector.

The collector accepts events from apps, stores them in Supabase, adds Qdrant memory, asks local DeepSeek/Ollama for an insight, and optionally sends the event plus insight to Activepieces.

## Start From A Healthy Stack

For the same-machine modular setup:

```bash
npm run modular:local:up
npm run doctor
```

Optional app modules:

```bash
npm run modular:activepieces:up
npm run activepieces:setup
npm run modular:uptime:up
npm run modular:umami:up
npm run modular:glitchtip:up
npm run modular:listmonk:up
npm run modular:zammad:up
```

Check URLs and local credentials:

```bash
npm run status
```

## Collector Contract

All event endpoints except `GET /health` require:

```text
X-API-Key: ${COLLECTOR_API_KEY}
Content-Type: application/json
```

Local collector URL:

```text
http://127.0.0.1:3005
```

Inside another container on the same machine, use:

```text
http://host.containers.internal:3005
```

Load the local API key:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)
```

## Endpoints

| Source | Endpoint | Purpose |
| --- | --- | --- |
| Custom app | `POST /v1/events` | Generic events |
| GlitchTip | `POST /v1/events/glitchtip` | Error events |
| Zammad | `POST /v1/events/zammad` | Support tickets |
| Uptime Kuma | `POST /v1/events/uptime-kuma` | Monitor up/down alerts |
| Umami | `POST /v1/events/umami` | Product analytics events |
| Listmonk | `POST /v1/events/listmonk` | Audience/subscriber events |

## GlitchTip To reduOS

Use when an application error should become an AI-analyzed reliability signal.

Local test:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events/glitchtip \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "event_id": "manual-glitchtip-001",
    "project": "AI-OS-Demo",
    "level": "error",
    "message": "PaymentProviderTimeout: checkout request timed out",
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

Shortcut:

```bash
npm run demo:glitchtip
```

In GlitchTip, configure a webhook target like:

```text
http://host.containers.internal:3005/v1/events/glitchtip
```

Add the collector API key as an `X-API-Key` header.

## Zammad To reduOS

Use when a customer support ticket should become an AI-analyzed support signal.

Local collector test:

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

Shortcut:

```bash
npm run demo:zammad
```

Create a real local Zammad ticket:

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
      "body": "The customer is blocked at billing and needs help.",
      "type": "web",
      "internal": false
    }
  }' | jq
```

To automate Zammad into reduOS, point a Zammad webhook or bridge worker at:

```text
http://host.containers.internal:3005/v1/events/zammad
```

Add `X-API-Key`.

## Uptime Kuma To reduOS

Use when monitor failures should become reliability incidents.

Local test:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events/uptime-kuma \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "heartbeat": {
      "status": 0,
      "msg": "timeout",
      "time": "2026-05-26T12:00:00.000Z"
    },
    "monitor": {
      "name": "Checkout API",
      "url": "https://api.example.com/checkout"
    },
    "msg": "Checkout API is down"
  }' | jq
```

Shortcut:

```bash
npm run demo:uptime
```

In Uptime Kuma, create a webhook notification with:

```text
POST http://host.containers.internal:3005/v1/events/uptime-kuma
```

Headers:

```text
Content-Type: application/json
X-API-Key: your-collector-api-key
```

## Umami To reduOS

Use when product analytics should become growth or product signals.

Local test:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events/umami \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "type": "analytics.event",
    "event": "pricing_cta_clicked",
    "url": "https://redu-os.local/pricing",
    "title": "Pricing",
    "referrer": "https://google.com",
    "visitor_id": "demo-visitor-001",
    "metadata": {
      "plan": "startup",
      "cta": "start_trial"
    }
  }' | jq
```

Shortcut:

```bash
npm run demo:umami
```

Umami does not need to call reduOS for basic page tracking. Use this endpoint from a custom event bridge when you want selected analytics events to enter the AI loop.

## Listmonk To reduOS

Use when audience events should become growth/customer signals.

Local test:

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

Shortcut:

```bash
npm run demo:listmonk
```

Add a real subscriber to the local Listmonk module:

```bash
source .local/listmonk/list.env

curl -i -X POST http://127.0.0.1:9000/subscription/form \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=real-subscriber@example.com" \
  --data-urlencode "name=Real Subscriber" \
  --data-urlencode "l=${LISTMONK_LIST_UUID}"
```

Use a small bridge worker or Listmonk webhook integration to post selected subscriber events to:

```text
http://host.containers.internal:3005/v1/events/listmonk
```

## Custom Apps To reduOS

Generic event:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "type": "product.feedback.created",
    "source": "custom-app",
    "severity": "medium",
    "user": {
      "email": "beta@example.com",
      "name": "Beta User"
    },
    "message": "The onboarding checklist is confusing after step three.",
    "metadata": {
      "area": "onboarding",
      "plan": "startup"
    }
  }' | jq
```

## Collector To Activepieces

Activepieces receives normalized events after the collector stores the event and creates an insight.

Automated local setup:

```bash
npm run modular:activepieces:up
npm run activepieces:setup
```

This writes webhook URLs into `.env`:

```env
AUTOMATION_WEBHOOK_URL=...
AUTOMATION_WEBHOOK_URLS=...
AUTOMATION_WEBHOOK_API_KEY=...
```

Then test:

```bash
npm run demo:full
```

For a custom webhook receiver:

```bash
AUTOMATION_WEBHOOK_URL="http://host.containers.internal:3010/webhook/reduos" \
AUTOMATION_WEBHOOK_URLS="http://host.containers.internal:3010/webhook/reduos" \
AUTOMATION_WEBHOOK_API_KEY="local-demo-key" \
npm run automation:enable
```

Mock receiver:

```bash
npm run automation:mock
npm run automation:enable:mock
npm run demo:onboarding
```

Automation webhook payload shape:

```json
{
  "event": {
    "id": "uuid",
    "type": "support.ticket.created",
    "source": "zammad",
    "severity": "high"
  },
  "insight": {
    "category": "Customer Support",
    "priority": "High",
    "recommended_action": "Review and escalate."
  }
}
```

## Confirm It Landed

Collector response should include:

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

Check Supabase records:

```bash
source .local/supabase-local.env

curl -sS "${SUPABASE_PUBLIC_URL}/rest/v1/startup_events?select=id,type,source,severity,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq
```

Check recent insights:

```bash
source .local/supabase-local.env

curl -sS "${SUPABASE_PUBLIC_URL}/rest/v1/ai_insights?select=id,event_id,category,priority,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq
```

Check Qdrant memory:

```bash
QDRANT_API_KEY=$(grep '^QDRANT_API_KEY=' .env | cut -d= -f2-)

curl -sS http://127.0.0.1:6333/collections/redu_os_events \
  -H "api-key: ${QDRANT_API_KEY}" | jq '.result.points_count'
```

Search memory:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/memory/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "query": "customer cannot finish onboarding",
    "limit": 5
  }' | jq
```

Dashboard:

```bash
npm run dashboard:auth:setup
npm run dashboard
```

Open:

```text
http://127.0.0.1:3006
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `401 Unauthorized` from collector | `X-API-Key` must match `COLLECTOR_API_KEY` in `.env`. |
| `curl: (7) Failed to connect to 127.0.0.1:3005` | Collector is not running. Run `npm run modular:collector:up` or `npm run modular:local:up`. |
| Collector returns `500` | Run `npm run logs:collector`; usually Supabase, Qdrant, or Ollama is down/misconfigured. |
| App container cannot call `127.0.0.1:3005` | Use `http://host.containers.internal:3005` from containers. |
| Qdrant points do not increase | Check `QDRANT_ENABLED=true`, `QDRANT_API_KEY`, and `npm run logs:qdrant`. |
| No Activepieces action row | Check `AUTOMATION_WEBHOOK_URLS`, rerun `npm run activepieces:setup`, then recreate the collector. |
| DeepSeek fallback insight appears | Ollama may be down or the model missing. Run `npm run doctor`. |

Useful commands:

```bash
npm run status
npm run doctor
npm run logs:collector
npm run logs:activepieces
npm run logs:glitchtip
npm run logs:zammad
```
