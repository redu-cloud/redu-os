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
- [x] **Runtime config overrides** — provider, model, base URL, API key changeable at runtime without restart; persisted to `.local/runtime-config.json` via volume mount

### Dashboard
- [x] **Codebase refactored** — 2708-line `src/dashboard.ts` monolith split into 32-file folder: `src/dashboard/` with `index.ts`, `config.ts`, `auth.ts`, `umami.ts`, `langfuse.ts`, `podman.ts`, `routes/` (10 files), `html/login.ts`, `html/shared.ts`, `html/spa/` (styles, utils, nav, bind, 12 page files)
- [x] **12-page SPA**: Overview, Events, Insights, Actions, Memory, Agents, Integrations, AI Config, Notifications, Feedback, Settings, Logs
- [x] Auth — session cookie, Supabase user validation, sign-out
- [x] Overview — live metrics, activity timeline, service health, quick-action demo buttons
- [x] Events — unified log, source/severity filters, expandable detail with full AI loop (event → insights → actions → feedback)
- [x] Insights — AI insight log with priority filter (case-insensitive `.ilike()` match)
- [x] Actions — approve / reject / mark complete controls, writes directly to Supabase
- [x] Memory — Qdrant semantic search UI
- [x] Agents — LangGraph invocation with mode selector and response display
- [x] Integrations — webhook endpoint docs, collector config, service status
- [x] **AI Config** — provider toggle (LiteLLM ↔ Ollama), model dropdowns (chat/embed separated), API key field; changes apply at runtime and are reflected immediately
- [x] **Notifications** — Discord, Slack, Telegram configuration; Edit/Save/Cancel/Test per channel; fires on every processed event; config persists across container restarts via `.local/runtime-config.json`
- [x] Feedback — feedback log + manual submission form
- [x] Settings — instance config, feature flags, URL map
- [x] **Logs** — container log viewer, reads all Podman containers grouped by service family, per-container tail/filter

### Infrastructure
- [x] Dashboard containerized — `Containerfile.dashboard` + `compose/dashboard.yml`, replaced `tsx` background process
- [x] `modular-service.sh` supports `dashboard` — `up`, `down`, `restart`, `status`, `logs`, `pull`
- [x] `start-full-stack.sh` uses `podman-compose` for dashboard (no more PID file)
- [x] Podman socket mounted into dashboard container — Logs page works via REST API (`/run/podman/podman.sock`)
- [x] `toContainerUrl()` — dashboard transparently rewrites `127.0.0.1` → `host.containers.internal` for all service URLs; collector does the same at startup via `containerizeUrl()`
- [x] `npm run modular:dashboard:*` scripts — `up`, `down`, `logs`, `status`
- [x] **Persistent runtime config** — `compose/collector.yml` mounts `.local/` as a volume; `runtime-config.json` survives container restarts and rebuilds

### Project
- [x] License — Apache 2.0 (`LICENSE` file)
- [x] `package.json` — SPDX `"license": "Apache-2.0"`, updated description
- [x] **Playwright visual verification** — all 11 Dashboard pages + Activepieces flows confirmed healthy; `chrome-for-testing` browser installed; favicon 404 and `[object Object]` action display bugs fixed
- [x] **Umami + Langfuse self-tracking snippets** — dashboard auto-provisions Umami website on startup (`UMAMI_WEBSITE_ID` persisted to `.env`), injects tracking script in both HTML pages, tracks SPA page navigations via `window.umami.track()`; LangGraph agent calls from the Agents page are traced to Langfuse as `reduos.dashboard.agent` (fire-and-forget, `langfuse_module: redu-os-dashboard`)
- [x] **External AI provider keys** — `OPENAI_ENABLED=true` + `gpt-4o-mini` routed through LiteLLM as `openai-default`; fixed compose bug where `environment:` block was blanking `env_file` API keys; full pipeline confirmed: event → GPT-4o-mini insight → automation → feedback

---

## 🚧 In progress / next up

- [x] **LiteLLM health probe** — replaced `/health/liveliness` ping with a 1-token chat completion; bad/expired API keys now show amber "Error" on the Overview service grid (tri-state: OK / Error / DOWN)
- [x] **Full AI loop for all integrations** — GlitchTip (error.created + error.resolved), Zammad (ticket.created + ticket.resolved via auto-wired webhook+triggers in `setup-zammad.sh`), Uptime Kuma (down + recovered), Listmonk (subscriber.created via proxy + unsubscribed via 60s poller), Umami (analytics.event)
- [x] **Auto-feedback on resolution** — `autoFeedbackOnRecovery`, `autoFeedbackOnTicketResolved`, `autoFeedbackOnErrorResolved`, `autoFeedbackOnUnsubscribe` in `supabase.ts`; each links resolution back to original event with delta time and score
- [x] **Source-aware AI prompt** — `buildEventContext()` extracts key fields per source; `SOURCE_INSTRUCTIONS` per-source guidance; `stripRaw()` removes raw payload (~2000 token saving); GlitchTip prompt names file/line in recommended action
- [x] **GlitchTip poller** — `src/dashboard/glitchtip-poller.ts` polls resolved issues every 60s, forwards as `error.resolved` events; uses Bearer API token provisioned by `setup-glitchtip.sh`
- [x] **Listmonk poller** — `src/dashboard/listmonk-poller.ts` polls unsubscribed contacts every 60s, forwards as `audience.subscriber.unsubscribed`; subscribe proxy notifies collector on subscription
- [x] **Public endpoint rate limiting** — `@fastify/rate-limit` with `global: false`; `/api/track` 60/min, `/api/zammad/contact` and `/api/listmonk/subscribe` 10/min
- [x] **Normalizer unit tests** — 65 tests in `src/normalizers.test.ts` covering all 5 normalizers (GlitchTip Slack+Sentry formats, Zammad, Uptime Kuma, Umami, Listmonk); run with `npm test`
- [x] **README rewrite** — contributor-focused README with value prop, architecture diagram, integrations table, quick start, contributing guide
- [x] **docs/ai-loop.md** — full pipeline explanation with source-specific metadata tables
- [ ] **Slack + Telegram notification test** — Discord confirmed working; Slack and Telegram channels need end-to-end test

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
- [x] **Real-time SSE** — `GET /api/events/stream`; shared server-side Supabase poller (4 s) fans out to all connected clients; Overview timeline prepends new rows with indigo flash animation + bumps event counter; Events page shows "N new events — Reload" banner; `LIVE` pulsing green dot in topnav when connected; auto-reconnects on drop
- [x] **Dark/light theme toggle** — moon/sun button in topnav; `[data-theme="dark"]` CSS vars on `<html>`; persisted to `localStorage`; works on both dashboard and login page; full dark overrides for cards, tables, inputs, badges, filters
- [ ] Mobile-responsive sidebar (drawer)
- [ ] Event detail — link to source tool (GlitchTip issue, Zammad ticket, etc.)
- [ ] Bulk action controls on Events page (mark all as reviewed, trigger AI on selected)

### Collector improvements
- [ ] Retry queue — buffer failed Activepieces calls and retry with backoff
- [ ] Rate limiting per source
- [ ] Schema validation for custom event payloads (Zod)
- [ ] Webhook signature verification (HMAC) for GlitchTip and Zammad

### Security
- [x] **Public proxy endpoint rate limiting** — `@fastify/rate-limit` applied to `/api/track` (60/min), `/api/zammad/contact` (10/min), `/api/listmonk/subscribe` (10/min)
- [ ] **Optional public API key** — lighter-weight key for public proxy endpoints to prevent abuse beyond rate limiting
- [ ] **Key rotation** — `COLLECTOR_API_KEY` rotation UI in Settings; revoke old key, generate new one, update all webhook configs

### Memory / AI
- [ ] Memory decay — configurable TTL or relevance scoring to archive old vectors
- [ ] Multi-model routing — auto-select model based on event category (e.g. code errors → Claude, marketing → GPT-4o)
- [ ] Prompt versioning — track which prompt version generated each insight
- [ ] AI insight confidence score — expose model uncertainty in the dashboard

### Integrations
- [ ] GitHub — PR opened, CI failed, release published
- [ ] Stripe — payment failed, churn, MRR milestone
- [ ] Linear / Jira — issue lifecycle events
- [ ] Resend / Postmark — email delivery/bounce events

### Ops
- [ ] `npm run doctor` improvements — check Podman socket, model availability, Supabase schema version
- [ ] One-command cloud deploy script (target: single Ubuntu VPS, installs Podman + starts full stack)
- [ ] Automated Supabase schema migrations — version-tracked, applied on startup

---

## 💡 Ideas / future

- **redu.cloud SaaS** — managed hosted version, multi-tenant Supabase, per-customer LiteLLM quota
- **CLI** — `reduos send-event`, `reduos query`, `reduos status` — scriptable from CI/CD
- **Mobile push** — push notifications for critical events / pending approvals
- **Audit log** — immutable record of all dashboard actions (who approved what, when)
- **Plugin system** — community-contributed normalizers and automation templates
