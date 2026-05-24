# reduOS Local Stack and Use Cases

This guide shows how to run and test the local reduOS stack built so far:

```text
Collector API -> Supabase records -> Qdrant memory -> Ollama/DeepSeek insight -> Action -> Feedback -> Future context
```

The goal is to give you one repeatable way to prove that events can enter the system, become structured operational data, receive AI analysis, be stored as memory, and later be used as context.

## What Runs Locally

| Service | Local URL | Purpose |
| --- | --- | --- |
| Collector | `http://127.0.0.1:3005` | Receives events, calls AI, stores records, triggers automation |
| Supabase API | `http://127.0.0.1:8000` | Local Postgres/PostgREST/Auth stack |
| Supabase Studio | `http://127.0.0.1:3000` | UI for inspecting tables |
| Qdrant | `http://127.0.0.1:6333` | Vector memory for events |
| Ollama | `http://127.0.0.1:11435` | Local model server |

Default models:

```text
DeepSeek chat model: deepseek-r1:1.5b
Embedding model:     nomic-embed-text
```

Local credentials and generated secrets are written to:

```text
.local/supabase-local.env
```

The root `.env` is generated from those local secrets so the collector can talk to Supabase, Qdrant, and Ollama.

## Start The Stack

Install dependencies once:

```bash
npm install
```

Start everything:

```bash
npm run stack:up
```

The first run can take a while because it downloads Supabase images, Qdrant, Ollama, `deepseek-r1:1.5b`, and `nomic-embed-text`.

Run the smoke test any time:

```bash
npm run stack:test
```

Stop the local stack:

```bash
npm run stack:down
```

## Quick Health Checks

Load local secrets into your shell:

```bash
set -a
source .local/supabase-local.env
set +a
```

Check the collector:

```bash
curl -sS http://127.0.0.1:3005/health | jq
```

Expected shape:

```json
{
  "ok": true,
  "service": "redu-os-collector",
  "version": "0.1.0"
}
```

Check Ollama models:

```bash
curl -sS http://127.0.0.1:11435/api/tags | jq '.models[].name'
```

Expected:

```text
"nomic-embed-text:latest"
"deepseek-r1:1.5b"
```

Check Qdrant:

```bash
curl -sS http://127.0.0.1:6333/collections \
  -H "api-key: ${QDRANT_API_KEY}" | jq
```

Check Supabase REST:

```bash
curl -sS "http://127.0.0.1:8000/rest/v1/startup_events?select=id&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq
```

## API Authentication

Every collector endpoint except `GET /health` requires:

```text
X-API-Key: your-collector-key
```

For the local stack:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"
```

Then use:

```bash
-H "X-API-Key: ${COLLECTOR_API_KEY}"
```

## Endpoint Summary

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `GET` | `/` | Small route map |
| `POST` | `/v1/events` | Generic event ingestion |
| `POST` | `/v1/events/glitchtip` | GlitchTip-style error event |
| `POST` | `/v1/events/zammad` | Zammad-style support ticket |
| `POST` | `/v1/events/uptime-kuma` | Uptime Kuma monitor event |
| `POST` | `/v1/events/umami` | Umami-style analytics event |
| `POST` | `/v1/actions` | Record an action taken by AI, automation, or a person |
| `POST` | `/v1/feedback` | Record the outcome of an event/action |
| `GET` | `/v1/context/similar` | Retrieve previous related events with insights, actions, and feedback |

## Generic Event Contract

Use `/v1/events` when your source system does not have a dedicated normalizer yet.

Required fields:

```json
{
  "type": "support.ticket.created",
  "source": "manual-test",
  "message": "A customer cannot finish onboarding and is asking for help."
}
```

Optional fields:

```json
{
  "severity": "high",
  "user": {
    "email": "founder@example.com",
    "name": "Demo Founder"
  },
  "metadata": {
    "plan": "startup",
    "area": "onboarding"
  }
}
```

Allowed severities:

```text
debug, info, low, medium, high, critical
```

## Use Case 1: Onboarding Support Ticket

This is the cleanest end-to-end demo.

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "type": "support.ticket.created",
    "source": "manual-test",
    "severity": "high",
    "user": {
      "email": "founder@example.com",
      "name": "Demo Founder"
    },
    "message": "A customer cannot finish onboarding and is asking for help.",
    "metadata": {
      "plan": "startup",
      "area": "onboarding"
    }
  }' | jq
```

What to look for:

```json
{
  "ok": true,
  "stored": true,
  "memory": {
    "stored": true
  },
  "insight": {
    "category": "onboarding",
    "priority": "High",
    "sentiment": "Negative",
    "summary": "A customer cannot finish onboarding and is asking for help.",
    "recommended_action": "Take immediate action to resolve onboarding issues."
  }
}
```

If `insight.raw.model` is `deepseek-r1:1.5b`, the local AI path is working.

If you see `insight.raw.error: "fetch failed"`, the collector could not reach Ollama. Check:

```bash
curl -sS http://127.0.0.1:11435/api/tags | jq
podman logs redu-os-collector --tail 100
podman logs redu-os-ollama --tail 100
```

## Use Case 2: Full Support Loop

This records an event, an action, feedback, then queries similar context.

```bash
export COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"
./examples/curl-support-loop.sh
```

The script does four things:

```text
1. Sends a support.ticket.created event
2. Records an action like create_support_task
3. Records feedback like ticket_resolved
4. Fetches similar context
```

This is the best demo for explaining the product loop:

```text
An issue happened -> reduOS analyzed it -> someone acted -> outcome was recorded -> future events can use that memory
```

## Use Case 3: Product Feedback

Use this when you want the collector to summarize and classify product feedback.

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "type": "product.feedback",
    "source": "in-app-feedback",
    "severity": "medium",
    "user": {
      "email": "customer@example.com",
      "name": "Demo Customer"
    },
    "message": "The dashboard is useful, but I need a weekly founder summary that groups support, outages, and product feedback.",
    "metadata": {
      "page": "/dashboard",
      "plan": "startup"
    }
  }' | jq
```

Expected behavior:

```text
Supabase: new row in startup_events and ai_insights
Qdrant: points_count increases
Ollama: returns an insight about product/reporting needs
```

## Use Case 4: Production Error From GlitchTip

Dedicated endpoint:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/events/glitchtip \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "project": "AI OS Demo",
    "level": "error",
    "message": "Checkout API failed",
    "culprit": "POST /api/checkout",
    "event": {
      "event_id": "abc123",
      "release": "v1.0.0",
      "environment": "production"
    }
  }' | jq
```

The normalizer turns this into:

```text
type:     error.created
source:   glitchtip
severity: high
message:  Checkout API failed
```

This is useful for a founder or operator view where production errors become business-relevant tasks.

## Use Case 5: Zammad Support Ticket

Dedicated endpoint:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/events/zammad \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "ticket": {
      "id": 123,
      "title": "Cannot create cloud instance",
      "state": "new",
      "priority": "high"
    },
    "customer": {
      "email": "alex@example.com",
      "name": "Alex Customer"
    },
    "article": {
      "body": "The instance form fails after I select a keypair. I am blocked from testing the product."
    }
  }' | jq
```

The normalizer turns this into:

```text
type:     support.ticket.created
source:   zammad
severity: high
message:  Cannot create cloud instance + article body
```

## Use Case 6: Uptime Kuma Monitor Alert

Monitor down:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/events/uptime-kuma \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "monitor": {
      "name": "Public API",
      "url": "https://api.example.com/health"
    },
    "heartbeat": {
      "status": 0,
      "msg": "timeout",
      "time": "2026-05-24T16:00:00Z"
    }
  }' | jq
```

The normalizer turns this into:

```text
type:     uptime.monitor.down
source:   uptime-kuma
severity: critical
message:  Public API: timeout
```

Monitor recovered:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/events/uptime-kuma \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "monitor": {
      "name": "Public API",
      "url": "https://api.example.com/health"
    },
    "heartbeat": {
      "status": 1,
      "msg": "200 OK",
      "time": "2026-05-24T16:05:00Z"
    }
  }' | jq
```

## Use Case 7: Umami Analytics Event

Dedicated endpoint:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/events/umami \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "hostname": "app.example.com",
    "url": "/onboarding/create-instance",
    "referrer": "/signup",
    "event_name": "onboarding_abandoned",
    "email": "founder@example.com"
  }' | jq
```

The normalizer turns this into:

```text
type:     analytics.event
source:   umami
severity: info
message:  onboarding_abandoned
```

## Recording Actions

Actions represent what the AI, an automation, or a human decided to do.

You usually need an `event_id` from a previous event response:

```bash
EVENT_ID="paste-event-id-here"
INSIGHT_ID="paste-insight-id-here"
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/actions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d "{
    \"startup_event_id\": \"${EVENT_ID}\",
    \"ai_insight_id\": \"${INSIGHT_ID}\",
    \"action_type\": \"create_support_task\",
    \"status\": \"completed\",
    \"target\": \"activepieces\",
    \"payload\": {
      \"task\": \"Send onboarding checklist\",
      \"assignee\": \"support\"
    },
    \"result\": {
      \"task_created\": true
    },
    \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }" | jq
```

Expected response:

```json
{
  "ok": true,
  "action_id": "uuid"
}
```

## Recording Feedback

Feedback tells reduOS whether an action worked.

```bash
EVENT_ID="paste-event-id-here"
ACTION_ID="paste-action-id-here"
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d "{
    \"startup_event_id\": \"${EVENT_ID}\",
    \"ai_action_id\": \"${ACTION_ID}\",
    \"feedback_type\": \"ticket_resolved\",
    \"score\": 1,
    \"result\": \"resolved\",
    \"metadata\": {
      \"resolution_time_minutes\": 42,
      \"ai_recommendation_used\": true
    }
  }" | jq
```

Expected response:

```json
{
  "ok": true,
  "feedback_id": "uuid"
}
```

Suggested score convention:

```text
1    good outcome
0    neutral or unknown
-1   bad outcome
```

## Querying Similar Context

Current v1 context lookup uses Supabase records. Qdrant stores event memory, but `/v1/context/similar` currently returns recent matching records by filters.

By type and source:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS "http://127.0.0.1:3005/v1/context/similar?type=support.ticket.created&source=zammad&limit=5" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" | jq
```

By user:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS "http://127.0.0.1:3005/v1/context/similar?user_email=founder@example.com&limit=5" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" | jq
```

Expected shape:

```json
{
  "ok": true,
  "items": [
    {
      "event": {},
      "insights": [],
      "actions": [],
      "feedback": []
    }
  ]
}
```

## Inspecting Supabase

Open:

```text
http://127.0.0.1:3000
```

The stack prints the Studio login at the end of `npm run stack:up`. The local defaults are also in:

```text
.local/supabase-local.env
```

Tables to inspect:

```text
startup_events
ai_insights
ai_actions
ai_feedback
```

CLI check for events:

```bash
set -a
source .local/supabase-local.env
set +a

curl -sS "http://127.0.0.1:8000/rest/v1/startup_events?select=id,type,source,severity,message,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq
```

CLI check for insights:

```bash
set -a
source .local/supabase-local.env
set +a

curl -sS "http://127.0.0.1:8000/rest/v1/ai_insights?select=id,startup_event_id,category,priority,sentiment,summary,recommended_action,created_at&order=created_at.desc&limit=5" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq
```

## Inspecting Qdrant Memory

Get collection status:

```bash
QDRANT_API_KEY="$(grep '^QDRANT_API_KEY=' .env | cut -d= -f2-)"

curl -sS http://127.0.0.1:6333/collections/redu_os_events \
  -H "api-key: ${QDRANT_API_KEY}" | jq
```

Get only point count:

```bash
QDRANT_API_KEY="$(grep '^QDRANT_API_KEY=' .env | cut -d= -f2-)"

curl -sS http://127.0.0.1:6333/collections/redu_os_events \
  -H "api-key: ${QDRANT_API_KEY}" | jq '.result.points_count'
```

Scroll stored points:

```bash
QDRANT_API_KEY="$(grep '^QDRANT_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:6333/collections/redu_os_events/points/scroll \
  -H "Content-Type: application/json" \
  -H "api-key: ${QDRANT_API_KEY}" \
  -d '{
    "limit": 5,
    "with_payload": true,
    "with_vector": false
  }' | jq
```

## Testing DeepSeek Directly

Generate text:

```bash
curl -sS -X POST http://127.0.0.1:11435/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-r1:1.5b",
    "prompt": "Return JSON only: {\"status\":\"ok\",\"message\":\"DeepSeek is running\"}",
    "stream": false
  }' | jq
```

Generate an embedding:

```bash
curl -sS -X POST http://127.0.0.1:11435/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "startup onboarding issue"
  }' | jq '.embedding | length'
```

Expected embedding size:

```text
768
```

## Reading Logs

Collector:

```bash
podman logs redu-os-collector --tail 150
```

Ollama:

```bash
podman logs redu-os-ollama --tail 150
```

Qdrant:

```bash
podman logs redu-os-qdrant --tail 150
```

Supabase containers:

```bash
podman ps --format '{{.Names}}' | grep '^supabase'
```

Example:

```bash
podman logs supabase-db --tail 150
```

## Common Problems

### `curl: (7) Failed to connect to 127.0.0.1 port 3005`

The collector is not running.

```bash
podman ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
podman logs redu-os-collector --tail 100
```

### `insight.raw.error` says `fetch failed`

The collector could not reach Ollama.

```bash
curl -sS http://127.0.0.1:11435/api/tags | jq
podman exec redu-os-ollama ollama list
podman logs redu-os-collector --tail 100
```

### Qdrant returns unauthorized

Use the generated API key:

```bash
QDRANT_API_KEY="$(grep '^QDRANT_API_KEY=' .env | cut -d= -f2-)"
```

Then retry with:

```bash
-H "api-key: ${QDRANT_API_KEY}"
```

### Supabase Studio works but tables are empty

Send a new event, then refresh these tables:

```text
startup_events
ai_insights
```

Also verify the schema was applied:

```bash
set -a
source .local/supabase-local.env
set +a

curl -sS "http://127.0.0.1:8000/rest/v1/startup_events?select=id&limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" | jq
```

### Git says `.git/objects` has insufficient permissions

This means some Git internals are owned by another user. From the repo root:

```bash
sudo chown -R "$USER:$USER" .git
```

Then retry:

```bash
git add .
```

## What This Proves So Far

The current local deliverable proves:

```text
1. Events can enter through a stable HTTP API.
2. Events are normalized into one internal schema.
3. Supabase stores structured operational history.
4. Ollama/DeepSeek generates an insight from each event.
5. Qdrant stores vector memory for later retrieval.
6. Actions and feedback can be recorded.
7. Similar context can be queried from prior events.
```

That is the foundation for a self-hosted AI operating loop for startup operations.

## Good Next Documentation Targets

The next useful docs after this guide would be:

```text
docs/architecture.md
docs/deployment.md
docs/integrations.md
docs/api-reference.md
```

For now, this guide is the main hands-on test document.
