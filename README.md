# reduOS

Self-hosted AI operations layer for startups. It connects your existing tools — error tracking, support, uptime, analytics, email — into one loop that watches for events, generates AI insights, triggers automation, and remembers what worked.

```
Event → Collector → Supabase → Qdrant memory → AI analysis → Activepieces → Notifications → Feedback → Future context
```

Each time an event is resolved (ticket closed, downtime recovered, error fixed), reduOS records the outcome and links it back to the original event. The next time something similar happens, the AI has that history as context.

---

## What it connects

| Tool | Events |
|---|---|
| **GlitchTip** | Error created, error resolved |
| **Zammad** | Ticket created, ticket resolved |
| **Uptime Kuma** | Monitor down, monitor recovered |
| **Umami** | Page views, custom events |
| **Listmonk** | Subscriber joined, subscriber churned |
| **Custom apps** | Any event via the generic `/v1/events` endpoint |

Insights go to **Discord, Slack, or Telegram**. Automation runs through **Activepieces**. Memory lives in **Qdrant**. Everything is stored in **Supabase**.

---

## Dashboard

A 12-page self-hosted dashboard: events, AI insights, automation actions, memory search, container logs, notification config, AI provider config.

---

## Quick start

Requirements: [Podman](https://podman.io/) and [podman-compose](https://github.com/containers/podman-compose).

```bash
git clone https://github.com/redu-cloud/redu-os
cd redu-os
cp .env.example .env
npm install
npm run full
```

`npm run full` starts all services (Supabase, Qdrant, Ollama, LiteLLM, LangGraph, Activepieces, collector, dashboard). First run downloads `deepseek-r1:1.5b` and `nomic-embed-text` — takes a few minutes.

Open `http://127.0.0.1:3006` and sign in with `admin@example.com / ChangeMeStrong123!`.

**Useful commands after boot:**

```bash
npm run status           # Check what's running
npm run doctor           # Health check all services
npm run demo:full        # End-to-end event → AI → automation demo
npm run logs             # Tail all logs
npm run stack:down       # Stop everything
```

**Individual modules** (if you don't want the full stack):

```bash
npm run modular:uptime:up      # Uptime Kuma
npm run modular:glitchtip:up   # GlitchTip error tracking
npm run modular:zammad:up      # Zammad support
npm run modular:listmonk:up    # Listmonk email
npm run modular:umami:up       # Umami analytics
```

---

## Configuration

Edit `.env` before starting. The main values:

| Variable | Purpose |
|---|---|
| `COLLECTOR_API_KEY` | Secret for all webhook endpoints — change this |
| `AI_PROVIDER` | `ollama` (local), `litellm` (gateway), `openai-compatible`, `fallback` |
| `OLLAMA_MODEL` | Local chat model (default: `deepseek-r1:1.5b`) |
| `DISCORD_WEBHOOK_URL` | Notifications (optional) |
| `SLACK_WEBHOOK_URL` | Notifications (optional) |
| `OPENAI_API_KEY` | If you want GPT-4o-mini via LiteLLM |

AI provider and model can also be changed at runtime from the dashboard (`/#ai-config`) without restarting.

---

## Sending events

All collector endpoints require `X-API-Key: your-collector-key`.

```bash
curl -X POST http://127.0.0.1:3005/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: change-me-please" \
  -d '{
    "type": "support.ticket.created",
    "source": "zammad",
    "severity": "medium",
    "message": "User cannot complete onboarding",
    "user": { "email": "user@example.com" },
    "metadata": { "ticket_id": "42" }
  }'
```

Response includes the stored event ID, AI insight, automation result, and memory status.

See [docs/integration-webhooks.md](docs/integration-webhooks.md) for webhook setup per tool and [examples/](examples/) for more curl examples.

---

## Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │                 reduOS                      │
                        │                                             │
  GlitchTip ──────────► │  Collector (Fastify/TS)                    │
  Zammad ──────────────► │    normalizers.ts                          │
  Uptime Kuma ─────────► │    ↓                                       │
  Umami ───────────────► │  Supabase (startup_events,                 │
  Listmonk ────────────► │           ai_insights, ai_actions,         │
  Custom apps ─────────► │           ai_feedback)                     │
                        │    ↓                                        │
                        │  Qdrant (vector memory)                     │
                        │    ↓                                        │
                        │  Ollama / LiteLLM (AI insight)             │
                        │    ↓                                        │
                        │  Activepieces (automation)                  │
                        │    ↓                                        │
                        │  Discord / Slack / Telegram                 │
                        │    ↓                                        │
                        │  Feedback → future context                  │
                        └─────────────────────────────────────────────┘
```

The dashboard (`src/dashboard/`) serves the SPA and acts as an authenticated proxy for service calls. The collector (`src/server.ts`) handles all event ingestion and the AI loop.

---

## Testing

```bash
npm test                  # Run normalizer unit tests
npm run check             # TypeScript type check
npm run lint:scripts      # Validate shell scripts
npm run verify:fresh      # Pre-release sanity check
```

---

## Documentation

- [Local Stack and Use Cases](docs/local-stack-and-use-cases.md) — one-command stack, curl examples, scenarios
- [Deployment Modes](docs/deployment-modes.md) — single machine vs modular split-VM
- [Modular VM Walkthrough](docs/modular-vm-walkthrough.md) — collector, Qdrant, Ollama on separate VMs
- [Production Deployment](docs/production-deployment.md) — HTTPS, secrets, backups, upgrades
- [Integration Webhooks](docs/integration-webhooks.md) — connect GlitchTip, Zammad, Uptime Kuma, Umami, Listmonk
- [AI Provider Modes](docs/ai-provider-modes.md) — local Ollama, LiteLLM gateway, direct OpenAI-compatible, fallback
- [Activepieces Automation](docs/activepieces.md) — webhook flows, use-case templates
- [LangGraph Agents](docs/langgraph.md) — multi-step agents for support, incidents, onboarding
- [AI Loop](docs/ai-loop.md) — how events become insights and how feedback closes the loop

---

## Contributing

Contributions are welcome — bug fixes, new integrations, docs improvements, and tests.

**Good first issues:**
- Add a normalizer for a new tool (GitHub, Stripe, Linear, Resend)
- Add unit tests for edge cases in existing normalizers
- Improve AI prompts in `src/ollama.ts` for a specific event source
- Add a dashboard page or improve an existing one

**How to add a new integration:**

1. Write a normalizer in `src/normalizers.ts` — takes raw webhook payload, returns `NormalizedEvent`
2. Add a route in `src/server.ts` — `app.post("/v1/events/yourtool", ...)`
3. Add unit tests in `src/normalizers.test.ts`
4. Add a doc page in `docs/`
5. Add a demo script in `scripts/`

All normalizers follow the same pattern — see `normalizeZammad` or `normalizeUptimeKuma` as references.

**Dev setup:**

```bash
git clone https://github.com/redu-cloud/redu-os
cd redu-os
cp .env.example .env        # Fill in at minimum: COLLECTOR_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev                  # Starts collector with hot reload
npm test                     # Run tests
npm run check                # TypeScript
```

To run the full stack locally, follow the [Quick start](#quick-start) section above.

Please open an issue before starting large changes so we can discuss the approach.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
