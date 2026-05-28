# Uptime Kuma Monitoring

Uptime Kuma is the first optional app module for the modular reduOS stack. It gives the small local tier a real monitoring UI for Collector, Supabase, Qdrant, Ollama, Dashboard, Activepieces, and any external apps you want to watch.

## Start It

```bash
npm run modular:uptime:up
npm run modular:uptime:status
```

`modular:uptime:up` starts MariaDB, starts Uptime Kuma, creates the owner account, creates the default stack monitors, and prints the login.

Open:

```text
http://127.0.0.1:3001
```

Default local login:

```text
username: admin
password: ChangeMeStrong123
```

You can override these before the first run:

```env
UPTIME_KUMA_ADMIN_USERNAME=admin
UPTIME_KUMA_ADMIN_PASSWORD=change-this-password
```

Runtime data is stored in:

```text
.local/uptime-kuma
```

## Monitors

The setup command creates HTTP monitors for all core and modular services:

```text
reduOS Collector     http://host.containers.internal:3005/health
reduOS Dashboard     http://host.containers.internal:3006
Supabase API         http://host.containers.internal:8000/rest/v1/
Supabase Studio      http://host.containers.internal:3000
Qdrant               http://host.containers.internal:6333/collections
Ollama               http://host.containers.internal:11435/api/tags
LiteLLM              http://host.containers.internal:4000/health
LangGraph            http://host.containers.internal:3010/health
Activepieces         http://host.containers.internal:8080
Umami                http://host.containers.internal:3002/api/heartbeat
GlitchTip            http://host.containers.internal:8001/api/0/
Listmonk             http://host.containers.internal:9000/
Zammad               http://host.containers.internal:8081
Langfuse             http://host.containers.internal:3007/api/public/health
```

Auth headers are injected automatically when secrets are available (Qdrant `api-key`, Supabase `apikey`, LiteLLM and LangGraph `Authorization`).

The setup is idempotent — rerunning skips monitors that already exist by name:

```bash
npm run uptime:setup
```

To skip default monitor creation:

```env
UPTIME_KUMA_CREATE_MONITORS=false
```

## Webhook Notification → AI Loop

Every monitor is wired to a webhook notification that POSTs to the collector when a service changes state (down or recovered). This triggers the full reduOS AI loop.

### How It Works

```
Uptime Kuma detects service down/recovered
          ↓
POST /v1/events/uptime-kuma
  X-API-Key: <COLLECTOR_API_KEY>
  Body: { heartbeat, monitor, msg }
          ↓
Collector normalises into a standard event:
  type:     "uptime.monitor.down" | "uptime.monitor.recovered"
  severity: "critical"            | "info"
  source:   "uptime-kuma"
  message:  "<ServiceName>: <error>"
  metadata: { monitor_name, monitor_url, status, ... }
          ↓
Stored in Supabase (startup_events)
          ↓
Embedded and stored in Qdrant vector memory
  → future incidents for the same service retrieve this as context
          ↓
AI analysis (GPT-4o-mini / Ollama)
  → queries Qdrant for similar past incidents first
  → returns: category, priority, summary, recommended_action
  → summary always names the affected service (e.g. "Listmonk is unreachable")
          ↓
Activepieces automation triggered
  → create support ticket, notify on-call, run remediation
          ↓
Discord / Slack / Telegram notification
          ↓
Feedback recorded (manual or auto-correlated on recovery)
  → stored in ai_feedback, fed back as context on next incident
```

### Why Qdrant Memory Matters

On the first incident for a service, the AI has no prior context and gives a generic recommendation.

After several incidents, Qdrant surfaces past events for the same monitor. The AI can then reason:

- "Listmonk went down 3 times this week — this looks like a recurring issue, not a one-off"
- "Last time Zammad was down, it recovered within 4 minutes without intervention"
- "When multiple services go down simultaneously, it has correlated with a network partition"

The recommendations become progressively more specific as the memory fills up.

## Test The AI Loop

Send a simulated monitor-down event to confirm the full pipeline:

```bash
curl -X POST "http://127.0.0.1:3005/v1/events/uptime-kuma" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $COLLECTOR_API_KEY" \
  -d '{
    "heartbeat": {"status": 0, "time": "2026-01-01 12:00:00", "msg": "Connection refused"},
    "monitor": {"id": 1, "name": "Listmonk", "url": "http://host.containers.internal:9000/"},
    "msg": "Listmonk is down"
  }'
```

Or use the npm shortcut:

```bash
npm run demo:uptime
```

The response includes `stored`, `insight`, `automation`, and `notifications` keys confirming each stage of the pipeline completed.

## Logs And Stop

```bash
npm run modular:uptime:logs
npm run logs:uptime
npm run uptime:setup
npm run modular:uptime:down
```

## Production Notes

- Put Uptime Kuma behind HTTPS before exposing it publicly.
- Use a strong owner password.
- Keep database storage on persistent disk.
- Prefer private networking for internal monitors.
- Configure Discord, email, or another notification channel in Uptime Kuma.
