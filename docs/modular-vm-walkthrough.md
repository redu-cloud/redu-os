# Modular VM Walkthrough

This guide turns the modular tier into runnable pieces.

Use it when you want the smallest complete reduOS loop, but not all on the same machine.

Example layout:

```text
VM 1: Collector
VM 2: Supabase
VM 3: Qdrant
VM 4: Ollama + DeepSeek
```

The collector is the only service users and integrations need to call. Supabase, Qdrant, and Ollama can live on private IPs.

## Files

Modular compose files:

```text
compose/collector.yml
compose/qdrant.yml
compose/ollama.yml
```

Helper script:

```text
scripts/modular-service.sh
```

Example collector env:

```text
.env.modular.example
```

## Common Prep On Each VM

Install:

```text
git
node
npm
podman
podman-compose
curl
jq
```

Clone the repo:

```bash
git clone <repo-url> redu-os
cd redu-os
npm install
```

Copy an env file:

```bash
cp .env.modular.example .env
```

Each VM only needs the env vars relevant to the service it runs, but keeping one shared `.env` shape is easier to reason about.

## VM 4: Ollama

Set `.env`:

```env
OLLAMA_PORT=11434
OLLAMA_MODEL=deepseek-r1:1.5b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

Start Ollama:

```bash
npm run modular:ollama:up
```

Pull models:

```bash
podman exec redu-os-ollama ollama pull deepseek-r1:1.5b
podman exec redu-os-ollama ollama pull nomic-embed-text
```

Verify from the Ollama VM:

```bash
curl -sS http://127.0.0.1:11434/api/tags | jq '.models[].name'
```

Verify from the collector VM:

```bash
curl -sS http://OLLAMA_PRIVATE_IP:11434/api/tags | jq '.models[].name'
```

Only expose `11434` on a trusted private network.

## VM 3: Qdrant

Set `.env`:

```env
QDRANT_API_KEY=replace-with-a-strong-key
QDRANT_REST_PORT=6333
QDRANT_GRPC_PORT=6334
```

Start Qdrant:

```bash
npm run modular:qdrant:up
```

Verify from the Qdrant VM:

```bash
curl -sS http://127.0.0.1:6333/collections \
  -H "api-key: ${QDRANT_API_KEY}" | jq
```

Verify from the collector VM:

```bash
curl -sS http://QDRANT_PRIVATE_IP:6333/collections \
  -H "api-key: replace-with-a-strong-key" | jq
```

Only expose `6333` to the collector VM or a trusted private network.

## VM 2: Supabase

You can use the existing local Supabase bootstrap on the Supabase VM:

```bash
npm run stack:up
```

For a dedicated Supabase VM, the important output is:

```text
SUPABASE_PUBLIC_URL
SERVICE_ROLE_KEY
```

The collector VM needs:

```env
SUPABASE_URL=http://SUPABASE_PRIVATE_IP:8000
SUPABASE_SERVICE_ROLE_KEY=service-role-key-from-supabase-vm
```

Verify from the collector VM:

```bash
curl -sS "http://SUPABASE_PRIVATE_IP:8000/rest/v1/startup_events?select=id&limit=1" \
  -H "apikey: SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" | jq
```

If Supabase is public, put HTTPS in front of it and do not expose service-role access casually.

## VM 1: Collector

Start from:

```bash
cp .env.modular.example .env
```

Set `.env` to point at the other VMs:

```env
PORT=3005
COLLECTOR_API_KEY=replace-with-a-strong-key

SUPABASE_URL=http://SUPABASE_PRIVATE_IP:8000
SUPABASE_SERVICE_ROLE_KEY=service-role-key-from-supabase-vm

QDRANT_ENABLED=true
QDRANT_URL=http://QDRANT_PRIVATE_IP:6333
QDRANT_API_KEY=replace-with-qdrant-api-key
QDRANT_COLLECTION=redu_os_events
QDRANT_FALLBACK_EMBEDDINGS=true

AI_ENABLED=true
DEBUG_AI_RAW=false
OLLAMA_URL=http://OLLAMA_PRIVATE_IP:11434
OLLAMA_MODEL=deepseek-r1:1.5b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

Start collector:

```bash
npm run modular:collector:up
```

Verify:

```bash
curl -sS http://127.0.0.1:3005/health | jq
```

Send a test event:

```bash
COLLECTOR_API_KEY="$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:3005/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "type": "support.ticket.created",
    "source": "modular-test",
    "severity": "high",
    "user": {
      "email": "founder@example.com",
      "name": "Demo Founder"
    },
    "message": "A customer is blocked during onboarding because keypair selection failed.",
    "metadata": {
      "tier": "modular"
    }
  }' | jq
```

Search memory:

```bash
curl -sS -X POST http://127.0.0.1:3005/v1/memory/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${COLLECTOR_API_KEY}" \
  -d '{
    "query": "onboarding blocked by keypair selection",
    "limit": 5
  }' | jq
```

## NPM Commands

Collector VM:

```bash
npm run modular:collector:up
npm run modular:collector:status
npm run modular:collector:logs
npm run modular:collector:down
```

Qdrant VM:

```bash
npm run modular:qdrant:up
npm run modular:qdrant:status
npm run modular:qdrant:logs
npm run modular:qdrant:down
```

Ollama VM:

```bash
npm run modular:ollama:up
npm run modular:ollama:status
npm run modular:ollama:logs
npm run modular:ollama:down
```

Lower-level form:

```bash
bash scripts/modular-service.sh collector up
bash scripts/modular-service.sh qdrant logs
bash scripts/modular-service.sh ollama status
```

## Firewall Summary

Allow:

```text
Users/integrations -> collector:3005 or HTTPS proxy
Collector -> Supabase:8000 or HTTPS
Collector -> Qdrant:6333
Collector -> Ollama:11434
Admin -> Supabase Studio:3000 or HTTPS
```

Do not broadly expose:

```text
Supabase service-role access
Qdrant without API key
Ollama without a private network or proxy/auth
```

## Rollout Order

The lowest-risk way to modularize:

```text
1. Start with one-VM smallest complete tier.
2. Move Ollama first and update OLLAMA_URL.
3. Run a normal event demo.
4. Move Qdrant and update QDRANT_URL/QDRANT_API_KEY.
5. Run memory search.
6. Move Supabase last and update SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
```

This keeps each failure easy to isolate.
