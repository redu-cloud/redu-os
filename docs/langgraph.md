# LangGraph Agents

LangGraph is the optional workflow and agent module for reduOS. The collector still owns ingestion and storage. LangGraph runs multi-step reasoning workflows on top of collector events, memory search, LiteLLM/Ollama, and optional automation.

Default path:

```text
LangGraph -> collector memory search -> LiteLLM -> action decision
```

Optional record-back path:

```text
LangGraph -> collector /v1/events -> Supabase + Qdrant + automation
```

## Start LangGraph

Start the same-machine modular stack first:

```bash
npm run modular:local:up
```

If LiteLLM is enabled, LangGraph will use it automatically:

```bash
npm run modular:litellm:up
```

Then start LangGraph:

```bash
npm run modular:langgraph:up
```

The command generates stable LangGraph settings in `.local/langgraph-local.env`, mirrors them into `.env`, builds the local LangGraph API image, starts `redu-os-langgraph`, waits for `/health`, and prints the API key.

Check status:

```bash
npm run modular:langgraph:status
npm run status
```

Default local URL:

```text
http://127.0.0.1:3010
```

## Test Health

```bash
LANGGRAPH_URL=$(grep '^LANGGRAPH_URL=' .env | cut -d= -f2-)

curl -sS "${LANGGRAPH_URL}/health" | jq
```

## Run A Support Agent

```bash
LANGGRAPH_URL=$(grep '^LANGGRAPH_URL=' .env | cut -d= -f2-)
LANGGRAPH_API_KEY=$(grep '^LANGGRAPH_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST "${LANGGRAPH_URL}/v1/agents/support" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${LANGGRAPH_API_KEY}" \
  -d '{
    "source": "zammad",
    "severity": "high",
    "message": "A customer cannot finish onboarding after connecting their first data source.",
    "user_email": "founder@example.com",
    "user_name": "Demo Founder",
    "metadata": {
      "plan": "startup",
      "area": "onboarding"
    },
    "record_to_collector": false,
    "trigger_automation": false
  }' | jq
```

Or use the bundled demo:

```bash
npm run demo:langgraph
```

Expected shape:

```json
{
  "ok": true,
  "run_id": "uuid",
  "similar_context": [],
  "insight": {
    "category": "Support Triage",
    "priority": "high",
    "recommended_action": "specific next step"
  },
  "action": {
    "status": "pending_approval",
    "requires_human_approval": true
  }
}
```

## Agent Endpoints

All agent endpoints require `X-API-Key: ${LANGGRAPH_API_KEY}`.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/graph/invoke` | Generic workflow invocation |
| `POST /v1/agents/incident` | Incident response workflow |
| `POST /v1/agents/support` | Support triage workflow |
| `POST /v1/agents/onboarding` | Startup onboarding workflow |
| `POST /v1/agents/product-signal` | Product signal workflow |

## Provider Modes

With LiteLLM:

```env
LANGGRAPH_AI_ENABLED=true
LANGGRAPH_AI_PROVIDER=openai-compatible
LANGGRAPH_AI_BASE_URL=http://host.containers.internal:4000/v1
LANGGRAPH_AI_API_KEY=sk-your-litellm-key
LANGGRAPH_AI_MODEL=local-deepseek
```

Direct Ollama:

```env
LANGGRAPH_AI_ENABLED=true
LANGGRAPH_AI_PROVIDER=ollama
OLLAMA_URL=http://host.containers.internal:11435
OLLAMA_MODEL=deepseek-r1:1.5b
```

Fallback mode:

```env
LANGGRAPH_AI_ENABLED=false
```

Fallback mode still runs the workflow and returns a deterministic insight/action.

## Memory Search

By default, LangGraph uses the collector memory API:

```env
LANGGRAPH_MEMORY_ENABLED=true
LANGGRAPH_MEMORY_SEARCH_URL=http://host.containers.internal:3005/v1/memory/search
LANGGRAPH_MEMORY_API_KEY=${COLLECTOR_API_KEY}
```

This keeps Qdrant access behind the collector instead of exposing vector storage directly to every workflow service.

## Record Back To Collector

Set `record_to_collector=true` in a request when you want LangGraph output recorded back into reduOS:

```bash
curl -sS -X POST "${LANGGRAPH_URL}/v1/agents/incident" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${LANGGRAPH_API_KEY}" \
  -d '{
    "source": "uptime-kuma",
    "severity": "high",
    "message": "API health check is failing after the latest deployment.",
    "record_to_collector": true
  }' | jq
```

LangGraph posts a new `/v1/events` payload to the collector with `langgraph_run_id`, `langgraph_insight`, and `langgraph_action` in metadata.

## Automation

LangGraph can call a webhook directly when a request sets `trigger_automation=true` and the action does not require human approval:

```env
LANGGRAPH_AUTOMATION_ENABLED=true
LANGGRAPH_AUTOMATION_WEBHOOK_URL=https://automation.example.com/webhook/reduos
LANGGRAPH_AUTOMATION_WEBHOOK_API_KEY=optional-key
```

For high-risk actions, keep `LANGGRAPH_REQUIRE_HUMAN_APPROVAL_FOR_HIGH_RISK=true`.

## Logs And Reset

```bash
npm run logs:langgraph
npm run modular:langgraph:down
RESET_LOCAL_DATA=true RESET_MODE=all npm run reset:local
```
