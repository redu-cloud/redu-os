# Production Deployment

This guide is for a production-style self-hosted reduOS deployment. It is not a high-availability SaaS blueprint yet. The goal is a reliable, understandable setup that can start small, move pieces to separate VMs, and keep the same collector contract.

The production rule of thumb:

```text
Expose only HTTPS entry points. Keep databases, Qdrant, Ollama, Redis, and internal ports private.
```

## Deployment Tiers

### Tier A: One VM

Use this when you want the smallest complete reduOS deployment.

```text
VM 1:
  Collector
  Dashboard
  Supabase
  Qdrant
  Ollama + DeepSeek
```

Recommended machine:

```text
Minimum:      4 vCPU, 8 GB RAM, 80 GB SSD
Comfortable: 4-8 vCPU, 16 GB RAM, 120+ GB SSD
```

This tier is good for a private founder instance, a demo environment, or a small internal tool. Optional apps such as Activepieces, Uptime Kuma, Umami, GlitchTip, Listmonk, and Zammad can run here too, but Zammad and local AI both benefit from extra memory.

### Tier B: Two VMs

Use this when the local AI and data services are too heavy for one machine.

```text
VM 1:
  Reverse proxy
  Collector
  Dashboard
  Optional apps

VM 2:
  Supabase
  Qdrant
  Ollama + DeepSeek
```

The collector talks to VM 2 over private URLs:

```env
SUPABASE_URL=http://10.10.0.20:8000
QDRANT_URL=http://10.10.0.20:6333
OLLAMA_URL=http://10.10.0.20:11434
```

### Tier C: Modular VMs

Use this when you want each major component to scale, fail, or upgrade independently.

```text
VM 1: Reverse proxy + Collector + Dashboard
VM 2: Supabase
VM 3: Qdrant
VM 4: Ollama + DeepSeek
VM 5: LiteLLM, LangGraph, Activepieces, and optional apps
```

Useful sizing:

```text
Collector/Dashboard VM: 2 vCPU, 2-4 GB RAM
Supabase VM:           4 vCPU, 8-16 GB RAM, SSD
Qdrant VM:             2-4 vCPU, 4-8 GB RAM, SSD
Ollama VM:             4-8 vCPU, 16-32 GB RAM, SSD for models
Apps VM:               4 vCPU, 8-16 GB RAM
```

## DNS

Use clear service names. For example:

```text
collector.example.com      -> Collector API
dashboard.example.com      -> reduOS dashboard
supabase.example.com       -> Supabase API, if external clients need it
studio.example.com         -> Supabase Studio, admin-only
activepieces.example.com   -> Activepieces
uptime.example.com         -> Uptime Kuma
analytics.example.com      -> Umami
errors.example.com         -> GlitchTip
audience.example.com       -> Listmonk
support.example.com        -> Zammad
langfuse.example.com       -> Langfuse
ai.example.com             -> LiteLLM, admin-only or private
agents.example.com         -> LangGraph, admin-only or private
```

Keep private-only services off public DNS:

```text
qdrant.internal
ollama.internal
postgres.internal
redis.internal
```

## Ports

Expose these publicly only through a reverse proxy with HTTPS:

```text
80/443  Reverse proxy
3005    Collector
3006    Dashboard
8000    Supabase API, only if external clients need it
3000    Supabase Studio, admin-only
8080    Activepieces
3001    Uptime Kuma
3002    Umami
8001    GlitchTip
9000    Listmonk
8081    Zammad
3007    Langfuse
4000    LiteLLM, admin-only or private
3010    LangGraph, admin-only or private
```

Keep these private:

```text
6333    Qdrant
11434   Ollama
4000    LiteLLM if only used on the private network
3010    LangGraph if only used on the private network
5432    PostgreSQL
6379    Redis
3306    MariaDB
```

Firewall baseline:

```text
Allow SSH only from admin IPs.
Allow 80/443 to the reverse proxy.
Allow service ports only on the private network between VMs.
Deny everything else.
```

## Reverse Proxy

Caddy is a simple default for HTTPS. On a one-VM deployment:

```caddyfile
collector.example.com {
  reverse_proxy 127.0.0.1:3005
}

dashboard.example.com {
  reverse_proxy 127.0.0.1:3006
}

activepieces.example.com {
  reverse_proxy 127.0.0.1:8080
}

support.example.com {
  reverse_proxy 127.0.0.1:8081
}

langfuse.example.com {
  reverse_proxy 127.0.0.1:3007
}
```

On a split-VM deployment, point at private IPs:

```caddyfile
collector.example.com {
  reverse_proxy 10.10.0.10:3005
}

supabase.example.com {
  reverse_proxy 10.10.0.20:8000
}
```

Do not proxy Qdrant or Ollama publicly unless you add strong network controls and authentication in front of them.

## Secrets

Start from the modular example:

```bash
cp .env.modular.example .env
```

Replace every demo secret before production use:

```text
COLLECTOR_API_KEY
DASHBOARD_SESSION_SECRET
SUPABASE_SERVICE_ROLE_KEY
QDRANT_API_KEY
ACTIVEPIECES_ADMIN_PASSWORD
AP_ENCRYPTION_KEY
AP_JWT_SECRET
UPTIME_KUMA_PASSWORD
UMAMI_ADMIN_PASSWORD
GLITCHTIP_ADMIN_PASSWORD
LISTMONK_ADMIN_PASSWORD
ZAMMAD_ADMIN_PASSWORD
LANGFUSE_PUBLIC_KEY
LANGFUSE_SECRET_KEY
LANGFUSE_ADMIN_PASSWORD
LITELLM_MASTER_KEY
LITELLM_SALT_KEY
LANGGRAPH_API_KEY
```

Use shell-safe values in `.env`. Avoid unquoted spaces because the project scripts source `.env` files.

Never commit these paths:

```text
.env
.local/
```

If a webhook URL or API key is leaked, rotate it. Webhook URLs should be treated like credentials.

## Collector Service Map

In production, the collector `.env` is the service map:

```env
NODE_ENV=production
PORT=3005
COLLECTOR_API_KEY=replace-with-a-strong-key

SUPABASE_URL=https://supabase.example.com
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key

QDRANT_ENABLED=true
QDRANT_URL=http://10.10.0.30:6333
QDRANT_API_KEY=replace-with-qdrant-key
QDRANT_COLLECTION=redu_os_events

AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_URL=http://10.10.0.40:11434
OLLAMA_MODEL=deepseek-r1:1.5b
OLLAMA_EMBED_MODEL=nomic-embed-text

AUTOMATION_WEBHOOK_URL=https://activepieces.example.com/api/v1/webhooks/...
AUTOMATION_WEBHOOK_API_KEY=replace-with-webhook-key
```

The Supabase service role key belongs only on trusted servers. Do not put it in browser code, public dashboards, mobile apps, or client-side config.

To route model calls through LiteLLM instead:

```env
AI_ENABLED=true
AI_PROVIDER=litellm
AI_CHAT_BASE_URL=http://10.10.0.50:4000/v1
AI_CHAT_API_KEY=replace-with-litellm-master-key
AI_CHAT_MODEL=local-deepseek
AI_EMBEDDING_BASE_URL=http://10.10.0.50:4000/v1
AI_EMBEDDING_API_KEY=replace-with-litellm-master-key
AI_EMBEDDING_MODEL=local-embeddings
```

LiteLLM can still route to private Ollama first. Later, enable hosted model providers in the LiteLLM env without changing collector code.

To run LangGraph on a workflow VM:

```env
LANGGRAPH_URL=https://agents.example.com
LANGGRAPH_API_KEY=replace-with-lg-key
LANGGRAPH_AI_PROVIDER=openai-compatible
LANGGRAPH_AI_BASE_URL=http://10.10.0.50:4000/v1
LANGGRAPH_AI_API_KEY=replace-with-litellm-master-key
LANGGRAPH_AI_MODEL=local-deepseek
LANGGRAPH_MEMORY_SEARCH_URL=https://collector.example.com/v1/memory/search
LANGGRAPH_MEMORY_API_KEY=replace-with-collector-key
LANGGRAPH_COLLECTOR_URL=https://collector.example.com
LANGGRAPH_COLLECTOR_API_KEY=replace-with-collector-key
```

## Backups

Back up both data and configuration. A database backup without the matching `.env` secrets may not be enough to restore a working system.

Recommended backup targets:

```text
Supabase:     Postgres dumps, storage volumes, generated Supabase env
Qdrant:       Qdrant snapshots or volume snapshots
Ollama:       Model volume, or document exact model names and re-pull
Activepieces: Postgres, Redis if needed, `.env`
Langfuse:     Postgres, ClickHouse, Redis, MinIO, `.env`
LiteLLM:      Postgres, generated config, `.env`
LangGraph:    `.env`, image tag or git commit
Uptime Kuma:  MariaDB volume
Umami:        Postgres volume
GlitchTip:    Postgres, Redis, uploads
Listmonk:     Postgres, uploads
Zammad:       PostgreSQL data, Redis data, Zammad storage, backup volume
Collector:    `.env`, deployment unit, image tag or git commit
```

Store backups off-machine and test a restore before you rely on them.

## Restore Checklist

1. Stop the affected services.
2. Restore `.env` and generated local env files.
3. Restore databases and persistent volumes.
4. Start data services first: Supabase, Qdrant, Redis, MariaDB, PostgreSQL.
5. Start Ollama and confirm models are present.
6. Start the collector and dashboard.
7. Start optional apps.
8. Run smoke tests.

Useful checks:

```bash
npm run modular:collector:status
npm run modular:qdrant:status
npm run modular:ollama:status
npm run doctor
npm run demo:onboarding
npm run demo:memory
```

## Upgrade Checklist

1. Read release notes for the app or service being upgraded.
2. Take backups.
3. Update the reduOS repo.
4. Install dependencies.
5. Run local validation.
6. Upgrade one module at a time.
7. Run smoke tests after each module.

Commands:

```bash
npm install
npm run verify:fresh
npm run check
npm run lint:scripts
```

Then upgrade modules individually:

```bash
npm run modular:qdrant:up
npm run modular:ollama:up
npm run modular:collector:up
npm run modular:activepieces:up
npm run modular:uptime:up
npm run modular:umami:up
npm run modular:glitchtip:up
npm run modular:listmonk:up
npm run modular:zammad:up
```

## Monitoring

Use Uptime Kuma for HTTP checks:

```text
Collector:      https://collector.example.com/health
Dashboard:      https://dashboard.example.com
Supabase API:   https://supabase.example.com/rest/v1/
Activepieces:   https://activepieces.example.com
Uptime Kuma:    https://uptime.example.com
Umami:          https://analytics.example.com
GlitchTip:      https://errors.example.com
Listmonk:       https://audience.example.com
Zammad:         https://support.example.com
Langfuse:       https://langfuse.example.com
```

Also monitor:

```text
Disk usage on every VM
Memory pressure on Ollama and Zammad hosts
Supabase/Postgres backup age
Qdrant snapshot age
Collector error logs
Failed automation deliveries
```

## Production Smoke Tests

Set the public collector URL and API key:

```bash
export COLLECTOR_URL=https://collector.example.com
export API_KEY=replace-with-collector-api-key
```

Health:

```bash
curl -sS "${COLLECTOR_URL}/health" | jq
```

Post an event:

```bash
curl -sS -X POST "${COLLECTOR_URL}/v1/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "type": "support.ticket.created",
    "source": "production-smoke-test",
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

Search memory:

```bash
curl -sS -X POST "${COLLECTOR_URL}/v1/memory/search" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "query": "onboarding customers asking for help",
    "limit": 5
  }' | jq
```

Confirm the result in:

```text
Dashboard recent events
Supabase startup_events and ai_insights
Qdrant redu_os_events collection
Activepieces run history, if automation is enabled
```

## Known Limits

Current reduOS deployment files are intentionally simple and VM-friendly.

They do not yet provide:

```text
Automatic database replication
Automatic failover
Kubernetes manifests
Managed secrets integration
Zero-downtime migrations
Multi-region routing
```

That is acceptable for the smallest and modular tiers. For larger deployments, add managed backups, private networking, observability, and a tested restore process before adding more user-facing features.
