# reduOS

The reduOS app repository contains the collector service, database schema, example requests, and self-hosted deployment templates.

The marketing website lives in the separate `redu-os-website` project.

## Collector

Small event collector for the reduOS AI loop.

It receives events from tools like GlitchTip, Zammad, Uptime Kuma, Umami, Listmonk, Supabase, or custom apps. It normalizes those events into one schema, stores them in Supabase, optionally stores memory in Qdrant, optionally asks Ollama/DeepSeek for analysis, triggers Activepieces when configured, and records action/feedback outcomes.

reduOS learns by building operational memory: it stores events, decisions, actions, and outcomes, then retrieves similar context for future AI analysis.

It does not fine-tune a model automatically. v1 uses operational memory and retrieval.

## Flow

```text
Event -> Collector -> Supabase -> Qdrant memory -> Ollama analysis -> Activepieces action -> Feedback -> Future context
```

## Endpoints

All endpoints except `GET /health` require:

```text
X-API-Key: your-collector-key
```

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Service health check |
| `POST /v1/events` | Receive generic startup events |
| `POST /v1/events/glitchtip` | Receive GlitchTip webhook payloads |
| `POST /v1/events/zammad` | Receive Zammad webhook payloads |
| `POST /v1/events/uptime-kuma` | Receive Uptime Kuma webhook payloads |
| `POST /v1/events/umami` | Receive Umami-style event payloads |
| `POST /v1/actions` | Record what AI or automation decided to do |
| `POST /v1/feedback` | Record the outcome after an action |
| `GET /v1/context/similar` | Retrieve similar previous events, insights, actions, and feedback |
| `POST /v1/memory/search` | Search Qdrant event memory with a natural-language query |

## Schema

Run [`sql/schema.sql`](./sql/schema.sql) in the Supabase SQL Editor.

Tables:

- `startup_events`
- `ai_insights`
- `ai_actions`
- `ai_feedback`

RLS is enabled. The included policies allow the Supabase service role to manage these tables.

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Qdrant and Ollama are optional. If `QDRANT_ENABLED=false` and `AI_ENABLED=false`, the collector still stores events and creates fallback insights.

## Local Supabase + Qdrant + Ollama + Collector

To test the collector, local self-hosted Supabase, Qdrant memory, and local DeepSeek analysis together:

```bash
npm run stack:up
```

This downloads the official Supabase self-hosting Docker files into `.local/supabase`, applies the same Podman fixes used by `use-cases/supabase/cloud-init.yaml`, generates local keys, writes `.env` for the collector, applies `sql/schema.sql`, starts Supabase, Qdrant, Ollama, and the collector, pulls the local models, then posts one smoke-test event.

The first run downloads `deepseek-r1:1.5b` and `nomic-embed-text`, so it can take a few minutes.

Useful follow-up commands:

```bash
npm run doctor
npm run status
npm run stack:test
npm run demo:onboarding
npm run demo:memory
npm run logs:collector
npm run stack:down
```

Default local URLs:

- Collector: `http://127.0.0.1:3005` (`/health` for health check)
- Supabase API: `http://127.0.0.1:8000`
- Supabase Studio: `http://127.0.0.1:3000`
- Qdrant: `http://127.0.0.1:6333`
- Ollama: `http://127.0.0.1:11435`

Generated Supabase and Qdrant credentials live in `.local/supabase-local.env`.

Supabase stores the structured event/action/feedback records. Qdrant stores vector memory for events in the `redu_os_events` collection. Ollama runs DeepSeek for insight generation and `nomic-embed-text` for embeddings. If the embedding model is temporarily unavailable, the collector can still store memory with deterministic fallback embeddings.

By default, API responses return clean insight fields and omit the raw Ollama payload. Set `DEBUG_AI_RAW=true` when you want the response to include model internals for debugging.

Use `POST /v1/memory/search` or `npm run demo:memory` to search Qdrant memory with natural language.

Use `npm run doctor` to check local tools, ports, containers, APIs, models, Qdrant memory, and Supabase tables.

Use `npm run status` for a compact container/URL view, and `npm run logs`, `npm run logs:collector`, `npm run logs:ollama`, `npm run logs:qdrant`, or `npm run logs:supabase` when you need logs.

Use `npm run lint:scripts` to validate shell scripts. It runs `bash -n` everywhere and uses `shellcheck` automatically when installed.

Use `npm run verify:fresh` before releases or handoff. It checks the fresh-clone path: required files, documented npm scripts, executable scripts, env examples, compose parsing, TypeScript, and obvious tracked secret leaks.

To test webhook automation without Activepieces, run the local mock receiver:

```bash
npm run automation:mock
npm run automation:enable:mock
npm run demo:onboarding
```

The collector will POST each event and insight to the mock webhook and record an automatic `ai_actions` row.

To run real Activepieces locally:

```bash
npm run modular:activepieces:up
npm run activepieces:setup
```

`activepieces:setup` creates/signs in the local Activepieces owner, creates and publishes the reduOS webhook flow, writes the webhook URL/key into `.env`, and recreates the collector.

To exercise the prebuilt use-case workflows:

```bash
npm run demo:full
npm run demo:glitchtip
npm run demo:listmonk
npm run demo:umami
npm run demo:uptime
npm run demo:zammad
```

To use the local demo dashboard:

```bash
npm run dashboard:auth:setup
npm run dashboard
```

Open `http://127.0.0.1:3006` and sign in with the dashboard credentials printed by `npm run dashboard:auth:setup` or `npm run status`. The dashboard uses Supabase Auth, then shows recent events, AI insights, automation actions, service health, memory search, and demo buttons for support, reliability, product, growth, Umami, Uptime Kuma, Listmonk, GlitchTip, and Zammad events.

To reset generated local data, use the guarded reset command:

```bash
RESET_LOCAL_DATA=true npm run reset:local
RESET_LOCAL_DATA=true RESET_MODE=all npm run reset:local
```

`RESET_MODE=data` is the default and keeps downloaded Ollama models. `RESET_MODE=all` also removes Ollama models, generated Supabase files, and generated local secrets.

For a full walkthrough with health checks, curl examples, Supabase inspection, Qdrant inspection, DeepSeek tests, and realistic startup scenarios, see [Local Stack and Use Cases](./docs/local-stack-and-use-cases.md).

The smallest complete tier includes Supabase, Qdrant, Ollama/DeepSeek, and the collector on one machine. The modular tier uses the same collector env vars to point at Supabase, Qdrant, Ollama, or automation services running on other VMs. Use `.env.modular.example` as the starting point for that layout. See [Deployment Modes](./docs/deployment-modes.md).

Modular service commands:

```bash
npm run modular:local:up
npm run modular:local:down

npm run modular:collector:up
npm run modular:qdrant:up
npm run modular:ollama:up
npm run modular:activepieces:up
npm run modular:uptime:up
```

Use `modular:local:up` to run the exact same stack on one machine, but with Supabase, Qdrant, Ollama, and Collector started as separate modules. Individual services also have `:status`, `:logs`, and `:down` variants. See [Modular VM Walkthrough](./docs/modular-vm-walkthrough.md).

## Documentation

- [Local Stack and Use Cases](./docs/local-stack-and-use-cases.md): one-command stack, service checks, curl examples, support/product/error/uptime/analytics scenarios, and troubleshooting.
- [Deployment Modes](./docs/deployment-modes.md): smallest complete tier, modular split-VM tier, service contracts, network matrix, and rollout guidance.
- [Modular VM Walkthrough](./docs/modular-vm-walkthrough.md): compose files and commands for running collector, Qdrant, and Ollama on separate VMs.
- [Activepieces Automation](./docs/activepieces.md): run real Activepieces with PostgreSQL/Redis, create use-case workflows, and connect them to collector webhooks.
- [Uptime Kuma Monitoring](./docs/uptime-kuma.md): run the optional monitoring module and watch the local/modular stack.
- [Security](./SECURITY.md): local demo credentials, webhook handling, and production cautions.

## Build

```bash
npm run build
npm start
```

## Podman

```bash
podman build -t redu-os-collector:latest .
podman run --rm -p 3005:3005 --env-file .env redu-os-collector:latest
```

## Event example

```bash
curl -i -X POST http://127.0.0.1:3005/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: change-me-please" \
  -d '{
    "type": "support.ticket.created",
    "source": "zammad",
    "severity": "medium",
    "user": {
      "email": "customer@example.com",
      "name": "Demo Customer"
    },
    "message": "I cannot finish onboarding",
    "metadata": {
      "ticket_id": "123"
    }
  }'
```

Response includes:

```json
{
  "ok": true,
  "event_id": "uuid",
  "insight_id": "uuid",
  "action_id": "uuid-or-null",
  "memory": {},
  "automation": {},
  "insight": {}
}
```

## Action example

```bash
curl -i -X POST http://127.0.0.1:3005/v1/actions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: change-me-please" \
  -d '{
    "startup_event_id": "event-uuid",
    "ai_insight_id": "insight-uuid",
    "action_type": "create_support_task",
    "status": "completed",
    "target": "activepieces",
    "payload": {
      "task": "Send onboarding checklist"
    },
    "result": {
      "task_created": true
    }
  }'
```

## Feedback example

```bash
curl -i -X POST http://127.0.0.1:3005/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: change-me-please" \
  -d '{
    "startup_event_id": "event-uuid",
    "ai_action_id": "action-uuid",
    "feedback_type": "ticket_resolved",
    "score": 1,
    "result": "resolved",
    "metadata": {
      "resolution_time_minutes": 42,
      "ai_recommendation_used": true
    }
  }'
```

## Similar context

For v1, this endpoint uses Supabase only. It does not require Qdrant.

```bash
curl -sS "http://127.0.0.1:3005/v1/context/similar?type=support.ticket.created&source=zammad&limit=5" \
  -H "X-API-Key: change-me-please"
```

Response:

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

## Example scripts

```bash
./examples/curl-generic.sh
./examples/curl-action.sh
./examples/curl-feedback.sh
./examples/curl-context-similar.sh
./examples/curl-support-loop.sh
```

`curl-support-loop.sh` requires `jq`. It sends a support ticket event, records an action, records feedback, and queries similar context.

## Production notes

For production:

- use HTTPS in front of this service
- use a strong `COLLECTOR_API_KEY`
- keep `SUPABASE_SERVICE_ROLE_KEY` private
- deploy on a private network with Supabase/Qdrant/Ollama
- add rate limits at the proxy layer
