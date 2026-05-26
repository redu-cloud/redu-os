# Langfuse AI Observability

Langfuse is the optional AI observability module for reduOS. It records collector AI calls so you can inspect prompts, model output, latency, parsing failures, and fallback behavior.

Place in the stack:

```text
Collector -> Ollama/DeepSeek -> Langfuse trace
          -> Supabase insight
          -> Qdrant memory
```

## Start Langfuse

Start the normal local or modular stack first:

```bash
npm run modular:local:up
```

Then start Langfuse:

```bash
npm run modular:langfuse:up
```

The command generates missing Langfuse settings, stores stable Langfuse secrets in `.local/langfuse-local.env`, mirrors them into `.env`, starts the Langfuse v3 services, waits for the seeded project API keys to work, and prints the local login. If the same-machine collector is already running, it is restarted with Langfuse tracing enabled.

Default local URL:

```text
http://127.0.0.1:3007
```

Default local login:

```text
admin@example.com / ChangeMeStrong123
```

Langfuse is heavier than the small collector/Qdrant/Ollama loop. It runs:

```text
Langfuse web
Langfuse worker
PostgreSQL
ClickHouse
Redis
MinIO
```

## Enable Collector Tracing

`npm run modular:langfuse:up` writes:

```env
LANGFUSE_ENABLED=true
LANGFUSE_URL=http://127.0.0.1:3007
LANGFUSE_HOST=http://host.containers.internal:3007
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

`LANGFUSE_URL` is for your browser. `LANGFUSE_HOST` is for the collector. When the collector runs in a container on the same machine, it uses:

```env
LANGFUSE_HOST=http://host.containers.internal:3007
```

If you started Langfuse before the collector, start the same-machine modular stack again so the collector receives the Langfuse env:

```bash
npm run modular:local:up
```

## Test A Trace

Send any normal collector event:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "type": "support.ticket.created",
    "source": "langfuse-test",
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

Open Langfuse:

```text
http://127.0.0.1:3007
```

Look for a trace named:

```text
reduos.event.analysis
```

Inside the trace you should see a generation named:

```text
ollama.generate.insight
```

The trace input is the stored event. The generation input is the exact prompt sent to Ollama. The generation output is the raw Ollama response or fallback payload.

## Check From The API

Verify the seeded project API key:

```bash
LANGFUSE_URL=$(grep '^LANGFUSE_URL=' .env | cut -d= -f2-)
LANGFUSE_PUBLIC_KEY=$(grep '^LANGFUSE_PUBLIC_KEY=' .env | cut -d= -f2-)
LANGFUSE_SECRET_KEY=$(grep '^LANGFUSE_SECRET_KEY=' .env | cut -d= -f2-)

curl -sS "${LANGFUSE_URL}/api/public/projects" \
  -u "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | jq
```

## Modular VM Usage

On a separate Langfuse VM:

```bash
cp .env.modular.example .env
npm run modular:langfuse:up
```

On the collector VM, point to the Langfuse URL and use the project keys:

```env
LANGFUSE_ENABLED=true
LANGFUSE_HOST=https://langfuse.example.com
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_TIMEOUT_MS=2500
```

Then restart the collector:

```bash
npm run modular:collector:up
```

## Commands

```bash
npm run modular:langfuse:up
npm run modular:langfuse:status
npm run modular:langfuse:logs
npm run modular:langfuse:down
npm run langfuse:setup
npm run logs:langfuse
```

## Troubleshooting

If no traces appear:

```bash
npm run modular:langfuse:status
npm run logs:langfuse
npm run modular:collector:logs
```

Check the collector can reach Langfuse:

```bash
curl -sS http://127.0.0.1:3007/api/public/projects \
  -u "$(grep '^LANGFUSE_PUBLIC_KEY=' .env | cut -d= -f2-):$(grep '^LANGFUSE_SECRET_KEY=' .env | cut -d= -f2-)" | jq
```

If Langfuse is running but the collector was already started before `LANGFUSE_ENABLED=true`, restart the collector:

```bash
npm run modular:collector:up
```

If the Langfuse API is slow or unavailable, collector ingestion still succeeds. Langfuse tracing is best-effort and uses `LANGFUSE_TIMEOUT_MS` to avoid blocking the main event loop for too long.

If `npm run modular:local:up` rewrites `.env`, run this to mirror the persisted Langfuse secrets back into the project env:

```bash
bash scripts/langfuse-env.sh
npm run modular:local:up
```
