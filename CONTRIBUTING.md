# Contributing to reduOS

Contributions are welcome — integrations, tests, dashboard improvements, AI prompt tuning, and docs.

Please open an issue before starting any large change so we can discuss scope and avoid duplicate work.

## Dev setup

```bash
git clone https://github.com/redu-cloud/redu-os
cd redu-os
cp .env.example .env
npm install
npm run dev        # Collector with hot reload on :3005
npm test           # Run normalizer tests (65 tests)
npm run check      # TypeScript type check
```

The minimum `.env` values needed for local development without the full container stack:

```env
COLLECTOR_API_KEY=any-local-key
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AI_PROVIDER=fallback
QDRANT_ENABLED=false
```

To run the full stack (all 14 services):

```bash
npm run full
npm run doctor    # Verify all services are healthy
```

## How to add a new integration

Five steps, all required:

### 1. Normalizer

Add `normalizeYourTool(payload: unknown): NormalizedEvent` in [`src/normalizers.ts`](src/normalizers.ts).

The function receives the raw webhook body. It must return a `NormalizedEvent` with at minimum `type`, `source`, `message`, and `severity`. See `normalizeZammad` or `normalizeUptimeKuma` as references.

### 2. Route

Add a `POST` route in [`src/server.ts`](src/server.ts):

```typescript
app.post("/v1/events/yourtool", async (request, reply) => {
  const normalized = normalizeYourTool(request.body);
  await handleEvent(normalized);
  return reply.send({ ok: true });
});
```

### 3. Tests

Add a `describe` block in [`src/normalizers.test.ts`](src/normalizers.test.ts) covering:
- A representative happy-path payload
- Missing or null fields
- Any tool-specific edge cases

Run with `npm test`.

### 4. Doc

Add `docs/yourtool.md` explaining:
- Which events are captured
- How to configure the webhook on the external tool's side (with screenshots if helpful)
- Any special headers required (`X-API-Key`)

### 5. Demo script

Add `scripts/demo-yourtool.sh` with a sample `curl` that sends a realistic test event to the local collector. Follow the pattern in `scripts/demo-glitchtip.sh`.

## Project structure

```
src/
  server.ts              Collector HTTP API (Fastify)
  normalizers.ts         Per-tool event normalisation
  normalizers.test.ts    Unit tests (run with npm test)
  ollama.ts              AI analysis + embedding
  supabase.ts            Event persistence + auto-feedback
  qdrant.ts              Vector memory
  automation.ts          Activepieces webhook trigger
  notifications.ts       Discord / Slack / Telegram
  dashboard/
    index.ts             Dashboard entry point
    config.ts            Env vars and Supabase client
    auth.ts              Session helpers and preHandler hook
    routes/              One file per API route group
    html/
      spa/
        pages/           One file per dashboard page
        bind.ts          After-render JS event bindings
        styles.ts        Embedded CSS
        utils.ts         Shared JS utilities and SSE manager
        nav.ts           Navigation bar
        onboarding.ts    Onboarding widget
langgraph-app/
  app.py                 LangGraph agent (Python / FastAPI)
scripts/
  start-full-stack.sh    npm run full
  modular-service.sh     Per-service start/stop/logs
  setup-*.sh             Idempotent service configuration
sql/
  schema.sql             Supabase schema
compose/
  *.yml                  Per-service Podman Compose files
docs/                    Feature documentation
```

## Embedded JS rules

The SPA JavaScript lives inside TypeScript template literals. Two escape pitfalls to be aware of:

- Use `&apos;` (not `\'`) in HTML attribute values like `onclick` and `onchange` inside template literals.
- Use `\\n` (not `\n`) for a JavaScript newline escape inside a template literal string.

## Tests

```bash
npm test          # normalizer unit tests
npm run check     # TypeScript type check
npm run doctor    # full service health check
```

All normalizer tests must pass before a PR is merged. New normalizers require test coverage.

## Good first issues

- Add a normalizer for a new tool (GitHub events, Stripe webhooks, Linear issues, Resend bounces)
- Write tests for edge cases in existing normalizers
- Improve AI prompts in `src/ollama.ts` for a specific source
- Improve dashboard pages or add a new visualisation
- Add a setup script for a new service module

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npm run check` passes (no TypeScript errors)
- [ ] New integration has a normalizer, route, tests, doc, and demo script
- [ ] `CLAUDE.md` is not included in the commit
- [ ] PR description explains what changed and why

## License

By contributing you agree that your work is licensed under the [Apache 2.0 License](LICENSE).
