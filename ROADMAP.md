# reduOS — Roadmap

> Self-hosted AI operative system for startups.
> Events → Memory → AI → Automation → Feedback

---

## ✅ Done

### Core loop
- [x] Collector API (Fastify/TypeScript) — receives events from GlitchTip, Zammad, Uptime Kuma, Umami, Listmonk, custom apps
- [x] Event normalisation — unified schema across all sources
- [x] Supabase persistence — `startup_events`, `ai_insights`, `ai_actions`, `ai_feedback` tables
- [x] Qdrant vector memory — embeddings via `nomic-embed-text`, semantic similarity search
- [x] AI analysis — Ollama local models + LiteLLM gateway (routes to OpenAI, Anthropic, Gemini, Groq, OpenRouter)
- [x] Activepieces automation — webhook trigger, idempotent flow provisioning
- [x] Feedback loop — outcomes stored and fed back as context for future analysis
- [x] LangGraph agent — Python/FastAPI, invocable from dashboard
- [x] Langfuse LLM tracing — optional module

### Dashboard
- [x] 11-page SPA: Overview, Events, Insights, Actions, Memory, Agents, Integrations, AI Config, Feedback, Settings, Logs
- [x] Auth — session cookie, Supabase user validation, sign-out
- [x] Overview — live metrics, activity timeline, service health, quick-action demo buttons
- [x] Events — unified log, source/severity filters, expandable detail with full AI loop (event → insights → actions → feedback)
- [x] Insights — AI insight log with priority filter
- [x] Actions — approve / reject / mark complete controls, writes directly to Supabase
- [x] Memory — Qdrant semantic search UI
- [x] Agents — LangGraph invocation with mode selector and response display
- [x] Integrations — webhook endpoint docs, collector config, service status
- [x] AI Config — provider/model config display, Ollama model list
- [x] Feedback — feedback log + manual submission form
- [x] Settings — instance config, feature flags, URL map
- [x] **Logs** — container log viewer, reads all Podman containers grouped by service family, per-container tail/filter

### Infrastructure
- [x] Dashboard containerized — `Containerfile.dashboard` + `compose/dashboard.yml`, replaced `tsx` background process
- [x] `modular-service.sh` supports `dashboard` — `up`, `down`, `restart`, `status`, `logs`, `pull`
- [x] `start-full-stack.sh` uses `podman-compose` for dashboard (no more PID file)
- [x] Podman socket mounted into dashboard container — Logs page works via REST API (`/run/podman/podman.sock`)
- [x] `toContainerUrl()` — dashboard transparently rewrites `127.0.0.1` → `host.containers.internal` for all service URLs
- [x] `npm run modular:dashboard:*` scripts — `up`, `down`, `logs`, `status`

### Project
- [x] License — Apache 2.0 (`LICENSE` file)
- [x] `package.json` — SPDX `"license": "Apache-2.0"`, updated description

---

## 🚧 In progress / next up

- [ ] **Playwright visual verification** — verify Dashboard and Activepieces UI after session restart (MCP needs `--browser chromium`)
- [ ] **External AI provider keys** — add OpenAI / Anthropic / Groq keys to `.env` to enable cloud model routing through LiteLLM

---

## 📋 Backlog

### Multi-host log agent (`redu-os-agent`)

For production deployments on 2–5 hosts (e.g. redu.cloud), the current Podman socket approach only sees containers on the local machine.

**Plan:** A lightweight Fastify agent (same pattern as collector) deployed on each host:
- Runs on a fixed port (e.g. `3008`)
- Exposes `GET /containers` and `GET /containers/:name/logs` — proxies the local Podman socket
- Auth via shared `AGENT_API_KEY`
- Dashboard reads `REMOTE_LOG_AGENTS=http://10.0.0.1:3008,http://10.0.0.2:3008` and fans out requests in parallel
- Each response tagged with `host` field — Logs page groups containers by host

**Design notes:**
- Single-host (open source default): keep using the socket mount, no agent needed
- Multi-host (redu.cloud production): deploy agent on each node, configure dashboard with host list
- Not needed: Loki/Grafana unless >10 hosts or log retention/search becomes a requirement

### Dashboard improvements
- [ ] Real-time event stream (SSE) — live-push new events to Overview and Events pages without manual refresh
- [ ] Dark/light theme toggle
- [ ] Mobile-responsive sidebar (drawer)
- [ ] Event detail — link to source tool (GlitchTip issue, Zammad ticket, etc.)
- [ ] Bulk action controls on Events page (mark all as reviewed, trigger AI on selected)

### Collector improvements
- [ ] Retry queue — buffer failed Activepieces calls and retry with backoff
- [ ] Rate limiting per source
- [ ] Schema validation for custom event payloads (Zod)
- [ ] Webhook signature verification (HMAC) for GlitchTip and Zammad

### Memory / AI
- [ ] Memory decay — configurable TTL or relevance scoring to archive old vectors
- [ ] Multi-model routing — auto-select model based on event category (e.g. code errors → Claude, marketing → GPT-4o)
- [ ] Prompt versioning — track which prompt version generated each insight
- [ ] AI insight confidence score — expose model uncertainty in the dashboard

### Integrations
- [ ] GitHub — PR opened, CI failed, release published
- [ ] Slack / Discord — inbound events + outbound notifications as automation targets
- [ ] Stripe — payment failed, churn, MRR milestone
- [ ] Linear / Jira — issue lifecycle events
- [ ] Resend / Postmark — email delivery/bounce events

### Ops
- [ ] `npm run doctor` improvements — check Podman socket, model availability, Supabase schema version
- [ ] One-command cloud deploy script (target: single Ubuntu VPS, installs Podman + starts full stack)
- [ ] Health endpoint (`/health`) on collector and dashboard — machine-readable, for uptime monitoring
- [ ] Automated Supabase schema migrations — version-tracked, applied on startup

---

## 💡 Ideas / future

- **redu.cloud SaaS** — managed hosted version, multi-tenant Supabase, per-customer LiteLLM quota
- **CLI** — `reduos send-event`, `reduos query`, `reduos status` — scriptable from CI/CD
- **Mobile push** — push notifications for critical events / pending approvals
- **Audit log** — immutable record of all dashboard actions (who approved what, when)
- **Plugin system** — community-contributed normalizers and automation templates
