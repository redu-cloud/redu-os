# Deployment Modes

reduOS is designed around one core loop:

```text
event -> Supabase record -> Ollama/DeepSeek insight -> Qdrant memory -> memory search -> action -> feedback
```

The smallest official tier should still include that full loop. That means local AI and Qdrant are part of the smallest complete reduOS deployment, not optional extras.

## Tier 1: Smallest Complete Tier

Use this when you want the full reduOS loop on one machine.

Services:

```text
Collector
Supabase
Qdrant
Ollama + DeepSeek
```

This is the current local stack:

```bash
npm run stack:up
npm run doctor
npm run demo:onboarding
npm run demo:memory
npm run demo:listmonk
```

What this proves:

```text
1. Events can enter through the collector API.
2. Events are stored in Supabase.
3. DeepSeek generates an operational insight.
4. Qdrant stores event memory.
5. Natural-language memory search finds similar past events.
6. Actions and feedback can be recorded.
```

Recommended machine:

```text
Minimum:      4 vCPU, 8 GB RAM, 50 GB disk
Comfortable: 4-8 vCPU, 16 GB RAM, 80+ GB disk
```

Use cases:

```text
Solo founder demo
Small team internal tool
Local development
Private AI workflow testing
Low-volume event ingestion
```

Limits:

```text
No high availability
No built-in off-machine backups
No separate scaling for AI, database, or vector search
Not intended for production multi-tenant SaaS as-is
```

## Tier 2: Modular Tier

Use this when one VM is not enough, or when you want to place services near their workloads.

For runnable per-VM commands, see [Modular VM Walkthrough](./modular-vm-walkthrough.md).

The collector is the control point. It does not need Supabase, Qdrant, Ollama, or automation to be on the same VM. It only needs network access and env vars.

Example split:

```text
VM 1: Collector
VM 2: Supabase
VM 3: Qdrant
VM 4: Ollama + DeepSeek
VM 5: Activepieces or another automation receiver
```

You can also combine services:

```text
VM 1: Collector + reverse proxy
VM 2: Supabase
VM 3: Qdrant + Ollama
```

Or:

```text
VM 1: Collector + Qdrant
VM 2: Supabase
VM 3: Ollama
```

The important rule:

```text
The collector uses URLs. A service can be local, private-network remote, or externally hosted as long as the URL and credentials are correct.
```

## Collector Configuration

For the modular tier, the collector `.env` becomes the service map.

You can start from:

```bash
cp .env.modular.example .env
```

```env
PORT=3005
NODE_ENV=production
COLLECTOR_API_KEY=replace-with-a-strong-key

SUPABASE_URL=https://supabase.example.internal
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key

QDRANT_ENABLED=true
QDRANT_URL=http://qdrant.example.internal:6333
QDRANT_API_KEY=replace-with-qdrant-api-key
QDRANT_COLLECTION=redu_os_events
QDRANT_FALLBACK_EMBEDDINGS=true

AI_ENABLED=true
DEBUG_AI_RAW=false
OLLAMA_URL=http://ollama.example.internal:11434
OLLAMA_MODEL=deepseek-r1:1.5b
OLLAMA_EMBED_MODEL=nomic-embed-text

AUTOMATION_WEBHOOK_URL=
AUTOMATION_WEBHOOK_API_KEY=

MAX_EVENT_MESSAGE_LENGTH=8000
```

For a private network, prefer internal hostnames or private IPs:

```env
SUPABASE_URL=http://10.10.0.20:8000
QDRANT_URL=http://10.10.0.30:6333
OLLAMA_URL=http://10.10.0.40:11434
```

For public URLs, put HTTPS and authentication in front of each service.

## Service Contracts

### Supabase

Collector needs:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Required tables:

```text
startup_events
ai_insights
ai_actions
ai_feedback
```

Create them with:

```text
sql/schema.sql
```

### Qdrant

Collector needs:

```text
QDRANT_ENABLED=true
QDRANT_URL
QDRANT_API_KEY
QDRANT_COLLECTION=redu_os_events
```

The collector creates the collection automatically when the first event memory is stored or when memory search initializes it.

Expected embedding size with the default model:

```text
768
```

### Ollama

Collector needs:

```text
AI_ENABLED=true
OLLAMA_URL
OLLAMA_MODEL=deepseek-r1:1.5b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

Required model pulls on the Ollama host:

```bash
ollama pull deepseek-r1:1.5b
ollama pull nomic-embed-text
```

If Ollama is on another VM, it must listen on an address reachable by the collector.

Example Ollama service setting:

```text
OLLAMA_HOST=0.0.0.0:11434
```

Only expose this on a trusted private network or behind authentication.

### Automation

Collector can call any webhook-style automation receiver:

```env
AUTOMATION_WEBHOOK_URL=https://automation.example.internal/webhook/reduos
AUTOMATION_WEBHOOK_API_KEY=replace-with-webhook-key
```

This can later point at Activepieces, a custom worker, or a small local mock receiver.

For real Activepieces on the local/modular stack:

```bash
npm run modular:activepieces:up
npm run modular:uptime:up
```

See [Activepieces Automation](./activepieces.md).
See [Uptime Kuma Monitoring](./uptime-kuma.md).

For a local mock receiver:

```bash
npm run automation:mock
npm run automation:enable:mock
```

This sets:

```env
AUTOMATION_WEBHOOK_URL=http://host.containers.internal:3010/webhook/reduos
AUTOMATION_WEBHOOK_API_KEY=local-demo-key
```

For non-mock receivers, use `npm run automation:enable` with `AUTOMATION_WEBHOOK_URL`, optional `AUTOMATION_WEBHOOK_URLS`, and `AUTOMATION_WEBHOOK_API_KEY`.

## Network Matrix

For the modular tier, allow these connections:

| From | To | Port | Purpose |
| --- | --- | --- | --- |
| Users/integrations | Collector | `3005` or HTTPS proxy | Event ingestion |
| Collector | Supabase API | `8000` or HTTPS | Store/query records |
| Collector | Qdrant | `6333` | Store/search vector memory |
| Collector | Ollama | `11434` | Generate insights and embeddings |
| Collector | Automation webhook | app-specific | Trigger workflow |
| Admin | Supabase Studio | `3000` or HTTPS | Inspect data |

Do not expose service-role Supabase access, Qdrant, or Ollama broadly to the internet.

## Recommended Rollout

Start with the smallest complete tier:

```bash
npm run stack:up
npm run doctor
npm run demo:onboarding
npm run demo:memory
```

Then modularize one dependency at a time:

```text
1. Move Ollama to a separate VM.
2. Update OLLAMA_URL in the collector env.
3. Run npm run doctor.
4. Run npm run demo:onboarding.
5. Move Qdrant to a separate VM.
6. Update QDRANT_URL and QDRANT_API_KEY.
7. Run npm run demo:memory.
8. Move Supabase last, because it owns the system of record.
```

This keeps the system debuggable. If something breaks, only one network boundary changed.

## Production Notes

For anything beyond a private demo:

```text
Use HTTPS in front of public endpoints.
Use strong COLLECTOR_API_KEY and QDRANT_API_KEY values.
Keep SUPABASE_SERVICE_ROLE_KEY private.
Back up Supabase Postgres data.
Back up Qdrant storage if memory matters.
Protect Ollama on a private network.
Add firewall rules between VMs.
Use npm run doctor after every env or network change.
```

## Current Repo Support

Implemented now:

```text
Smallest complete tier on one VM
Collector env vars that can point to remote Supabase/Qdrant/Ollama
Modular compose files for collector, Qdrant, and Ollama
Doctor/status/logs/reset lifecycle commands
Qdrant semantic memory search
Deployment documentation
```

Next modular implementation work:

```text
Add service-specific cloud-init templates.
Add an automation webhook demo.
```
