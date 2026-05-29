# Cross-Source Correlator

The cross-source correlator is a background intelligence layer that automatically detects when events from different connected tools are part of the same underlying incident.

## How it works

Every 5 minutes the dashboard server runs a correlation tick:

1. Fetches the last 15 minutes of events from Supabase across all sources
2. Skips the tick if fewer than 3 events or fewer than 2 distinct sources are found (not enough signal)
3. Sends the events to LangGraph's `/v1/agents/correlate` endpoint
4. LangGraph searches Qdrant memory for past correlation patterns, then asks the AI model whether the events are causally connected
5. If `correlated: true` and confidence ≥ 0.65:
   - Posts a `system.correlation` event to the collector (gets embedded in Qdrant for future context)
   - Broadcasts a real-time SSE alert to every connected browser
6. A 10-minute cooldown prevents the same incident from re-alerting while it is still active

## SSE banner

When a correlation is detected the dashboard shows a fixed banner at the top of every page:

```
⚠ Correlation detected — uptime-kuma, glitchtip — API degradation causing spike in errors
   [View →]  [✕]
```

Clicking **View →** navigates to the Agents page where the full correlation result is displayed. The banner auto-dismisses after 60 seconds.

## Manual trigger

You can run a correlation check at any time from the **Agents** page (`/#agents`) using the Cross-Source Correlator card. Choose a time window (15 / 30 / 60 / 120 minutes) and click **Correlate now →**.

A positive result shows:
- Confidence percentage
- Sources involved (as badges)
- Root cause and summary from the AI
- Recommended action
- Confirmation that the result was saved to Qdrant memory

## Feedback loop

Correlation results appear in the **Actions** page as `pending_approval` records with source `correlator`.

- **Approve** → writes `correlation_confirmed` feedback (score +1) to `ai_feedback`, posts a `system.correlation.confirmed` event to the collector. The event is embedded in Qdrant so future correlation runs see that this pattern was real.
- **Reject** → writes `correlation_false_positive` feedback (score -1), posts `system.correlation.false_positive`. Future runs learn to discount this pattern.

## LangGraph endpoint

```bash
LANGGRAPH_URL=$(grep '^LANGGRAPH_URL=' .env | cut -d= -f2-)
LANGGRAPH_API_KEY=$(grep '^LANGGRAPH_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST "${LANGGRAPH_URL}/v1/agents/correlate" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${LANGGRAPH_API_KEY}" \
  -d '{
    "events": [
      {"source": "uptime-kuma", "type": "monitor.down",    "message": "API is down",        "severity": "critical", "created_at": "2026-05-29T10:00:00Z"},
      {"source": "glitchtip",   "type": "error.created",   "message": "500 on /api/orders", "severity": "high",     "created_at": "2026-05-29T10:00:30Z"},
      {"source": "zammad",      "type": "ticket.created",  "message": "Cannot checkout",    "severity": "medium",   "created_at": "2026-05-29T10:01:00Z"}
    ],
    "window_minutes": 15,
    "record_to_collector": false,
    "trigger_automation": false
  }' | jq
```

Response shape:

```json
{
  "ok": true,
  "correlated": true,
  "confidence": 0.91,
  "sources_involved": ["uptime-kuma", "glitchtip", "zammad"],
  "root_cause": "API service outage causing cascading errors and customer impact",
  "summary": "Three sources reported failures within 1 minute — consistent with a single backend failure",
  "recommended_action": "Check API server health and recent deployments",
  "priority": "critical"
}
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `LANGGRAPH_ENABLED` | `true` | Enables the correlator (requires LangGraph) |
| `LANGGRAPH_URL` | `http://127.0.0.1:3010` | LangGraph service URL |
| `LANGGRAPH_API_KEY` | generated | Authentication key for LangGraph |

The poller runs only when `LANGGRAPH_ENABLED=true` and `LANGGRAPH_URL` is reachable. It fails silently if LangGraph is down.
