<div align="center">

# reduOS

**The self-hosted AI operative system for startups**

Connect your tools. Watch events. Get AI insights. Automate. Remember what worked.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Podman](https://img.shields.io/badge/Podman-ready-892CA0?logo=podman&logoColor=white)](https://podman.io/)
[![Tests](https://img.shields.io/badge/tests-65%20passing-brightgreen)](#testing)

[Quick Start](#quick-start) · [Integrations](#integrations) · [How it learns](#how-it-learns) · [Contributing](#contributing) · [Docs](docs/)

</div>

---

![reduOS dashboard — Overview page showing live event loop, AI insights, and service health](dark-after.png)

---

## What is reduOS?

reduOS is a self-hosted operations layer that sits between your tools and your team. It collects events from error trackers, support desks, uptime monitors, analytics, and email tools — normalises them into one schema, runs AI analysis, triggers automation, and stores every outcome as memory for future decisions.

The core loop:

```
Event → Collector → Supabase → Qdrant memory → AI analysis → Activepieces → Notifications → Feedback → Future context
```

Every time something is resolved — a ticket closed, downtime recovered, an error fixed — reduOS links the outcome back to the original event. The next time something similar happens, the AI sees what happened last time.

---

## Quick Start

> Requires [Podman](https://podman.io/) and [podman-compose](https://github.com/containers/podman-compose).

```bash
git clone https://github.com/redu-cloud/redu-os
cd redu-os
cp .env.example .env
npm install
npm run full
```

`npm run full` starts all 13 services. The first run pulls `deepseek-r1:1.5b` and `nomic-embed-text` — allow a few minutes.

Open **http://127.0.0.1:3006** and sign in:

```
Email:    admin@example.com
Password: ChangeMeStrong123!
```

**Useful commands:**

```bash
npm run status        # Check what's running
npm run doctor        # Health check all services and models
npm run demo:full     # End-to-end demo: event → AI → automation → notification
npm run logs          # Tail all logs
npm run stack:down    # Stop everything
```

---

## Integrations

reduOS connects to the tools startups already use:

| Tool | Events captured | Full AI loop |
|---|---|---|
| **GlitchTip** | Error created, error resolved | ✅ |
| **Zammad** | Ticket created, ticket resolved | ✅ |
| **Uptime Kuma** | Monitor down, monitor recovered | ✅ |
| **Listmonk** | Subscriber joined, subscriber churned | ✅ |
| **Umami** | Page views, custom events | ✅ |
| **Custom apps** | Any event via `/v1/events` | ✅ |

**Full AI loop** means: event received → stored in Supabase → embedded in Qdrant → AI generates insight → Activepieces triggers automation → Discord/Slack/Telegram notification fires → outcome linked back as feedback.

Each service can be started as an optional module:

```bash
npm run modular:glitchtip:up    # GlitchTip error tracking
npm run modular:zammad:up       # Zammad support desk
npm run modular:uptime:up       # Uptime Kuma monitoring
npm run modular:listmonk:up     # Listmonk email
npm run modular:umami:up        # Umami analytics
```

![Integrations page showing webhook endpoints and service status](integrations-page.png)

---

## How it learns

Most ops tools fire alerts and forget. reduOS records outcomes.

When a ticket is resolved, reduOS automatically finds the original `ticket.created` event, calculates how long it took, and writes a scored feedback record linked to the AI insight and action that fired. When a monitor recovers, the same happens for the downtime event.

```
support ticket created (ticket_id: 42)
  → AI insight: "auth service issue, check JWT config"
  → Activepieces: creates Notion task
  → [3 hours later] ticket closed
  → auto-feedback: score +1, delta 3h, linked to original event
```

Next time a similar ticket arrives, the AI receives: *"last time this happened, it took 3 hours to resolve via JWT config fix."*

This context lives in Qdrant vector memory and is retrieved by semantic similarity — no manual tagging required.

---

## AI Configuration

AI provider is set in `.env` and switchable at runtime from the dashboard (`/#ai-config`):

| Provider | Config |
|---|---|
| **Ollama** (default) | `AI_PROVIDER=ollama`, `OLLAMA_MODEL=deepseek-r1:1.5b` |
| **LiteLLM gateway** | `AI_PROVIDER=litellm` — routes to OpenAI, Anthropic, Gemini, Groq, OpenRouter |
| **OpenAI-compatible** | `AI_PROVIDER=openai-compatible` + `AI_CHAT_BASE_URL` |
| **Fallback** | `AI_PROVIDER=fallback` — stores events, skips model calls |

Switch provider or model without restarting from `/#ai-config` in the dashboard.

---

## Stack

| Service | Port | Purpose |
|---|---|---|
| Collector (Fastify/TypeScript) | 3005 | Event ingestion and AI loop |
| Dashboard (Fastify/TypeScript) | 3006 | 12-page SPA — events, insights, actions, memory, logs |
| Supabase | 8000 | Structured storage (events, insights, actions, feedback) |
| Qdrant | 6333 | Vector memory for semantic retrieval |
| Ollama | 11435 | Local AI models |
| LiteLLM | 4000 | AI gateway (OpenAI/Anthropic/Gemini/Groq/OpenRouter) |
| LangGraph | 3010 | Multi-step agent workflows |
| Activepieces | 8080 | Automation flows triggered by insights |

---

## Testing

```bash
npm test          # 65 normalizer unit tests
npm run check     # TypeScript type check
npm run doctor    # Full service health check
```

---

## Contributing

Contributions are welcome — integrations, tests, dashboard improvements, AI prompt tuning, docs.

**Good first issues:**
- Add a normalizer for a new tool (GitHub events, Stripe webhooks, Linear issues, Resend bounces)
- Write tests for edge cases in existing normalizers
- Improve AI prompts in `src/ollama.ts` for a specific source
- Improve dashboard pages

**How to add a new integration — 5 steps:**

1. **Normalizer** — add `normalizeYourTool(payload)` in [`src/normalizers.ts`](src/normalizers.ts). Takes the raw webhook body, returns `NormalizedEvent`. See `normalizeZammad` or `normalizeUptimeKuma` as a reference.

2. **Route** — add `app.post("/v1/events/yourtool", ...)` in [`src/server.ts`](src/server.ts).

3. **Tests** — add a `describe` block in [`src/normalizers.test.ts`](src/normalizers.test.ts) covering the common payload shapes and edge cases.

4. **Doc** — add `docs/yourtool.md` explaining how to set up the webhook on the external service side.

5. **Demo script** — add `scripts/demo-yourtool.sh` with a sample curl.

**Dev setup:**

```bash
git clone https://github.com/redu-cloud/redu-os
cd redu-os
cp .env.example .env
# Set at minimum: COLLECTOR_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev        # Collector with hot reload on :3005
npm test           # Run tests
```

Please open an issue before starting large changes.

---

## Documentation

| Doc | Contents |
|---|---|
| [AI Loop](docs/ai-loop.md) | How events become insights and how feedback closes the loop |
| [Local Stack and Use Cases](docs/local-stack-and-use-cases.md) | One-command stack, curl examples, service-by-service walkthroughs |
| [Deployment Modes](docs/deployment-modes.md) | Single machine vs modular split-VM layout |
| [Production Deployment](docs/production-deployment.md) | HTTPS, secrets, backups, upgrades |
| [Integration Webhooks](docs/integration-webhooks.md) | Webhook setup for every supported tool |
| [AI Provider Modes](docs/ai-provider-modes.md) | Ollama, LiteLLM, OpenAI-compatible, fallback |
| [LangGraph Agents](docs/langgraph.md) | Multi-step agent workflows |
| [Activepieces Automation](docs/activepieces.md) | Automation flow setup and templates |

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
