# LiteLLM AI Gateway

LiteLLM is the optional AI gateway module for reduOS. It gives the collector one OpenAI-compatible API while letting the deployment choose local Ollama, OpenAI, Anthropic, Gemini, Groq, OpenRouter, or another compatible provider behind it.

Default path:

```text
Collector -> LiteLLM -> Ollama/DeepSeek
```

External provider path:

```text
Collector -> LiteLLM -> OpenAI/Anthropic/Gemini/Groq/OpenRouter
```

No-AI path:

```text
Collector -> deterministic fallback insight
```

## Start LiteLLM

Start the same-machine modular stack first:

```bash
npm run modular:local:up
```

Then start LiteLLM:

```bash
npm run modular:litellm:up
```

The command generates stable LiteLLM settings, stores local secrets in `.local/litellm-local.env`, writes `.local/litellm/config.yaml`, mirrors the collector AI settings into `.env`, starts LiteLLM with a small Postgres database, waits for `/v1/models`, and restarts the same-machine collector when it is already running.

Check status:

```bash
npm run modular:litellm:status
npm run status
```

Default local URL:

```text
http://127.0.0.1:4000
```

LiteLLM UI:

```text
http://127.0.0.1:4000/ui
```

## Test Models

Read the generated key:

```bash
LITELLM_URL=$(grep '^LITELLM_URL=' .env | cut -d= -f2-)
LITELLM_MASTER_KEY=$(grep '^LITELLM_MASTER_KEY=' .env | cut -d= -f2-)
```

List configured models:

```bash
curl -sS "${LITELLM_URL}/v1/models" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" | jq
```

Test chat through the local alias:

```bash
curl -sS "${LITELLM_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-deepseek",
    "messages": [
      {
        "role": "user",
        "content": "Return JSON only: {\"ok\": true, \"provider\": \"litellm\"}"
      }
    ],
    "temperature": 0.1
  }' | jq
```

Test embeddings through the local alias:

```bash
curl -sS "${LITELLM_URL}/v1/embeddings" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-embeddings",
    "input": "customer cannot finish onboarding"
  }' | jq '.data[0].embedding | length'
```

## Test Collector Through LiteLLM

After `npm run modular:litellm:up`, `.env` should contain:

```env
AI_PROVIDER=litellm
AI_CHAT_BASE_URL=http://host.containers.internal:4000/v1
AI_CHAT_MODEL=local-deepseek
AI_EMBEDDING_BASE_URL=http://host.containers.internal:4000/v1
AI_EMBEDDING_MODEL=local-embeddings
```

Post an event:

```bash
API_KEY=$(grep '^COLLECTOR_API_KEY=' .env | cut -d= -f2-)

curl -sS -X POST http://127.0.0.1:3005/v1/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "type": "support.ticket.created",
    "source": "manual-test",
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

The `insight.raw` payload should show an OpenAI-compatible chat response when `DEBUG_AI_RAW=true`. If Langfuse is enabled, the trace metadata should show `ai_provider=litellm`.

## Use External Providers

Enable a provider in `.env`, then restart LiteLLM:

```env
OPENAI_ENABLED=true
OPENAI_API_KEY=sk-your-key
OPENAI_CHAT_MODEL=gpt-4o-mini
LITELLM_DEFAULT_CHAT_MODEL=openai-default
```

```bash
npm run modular:litellm:up
```

Other supported blocks:

```env
ANTHROPIC_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_CHAT_MODEL=claude-3-5-haiku-latest

GEMINI_ENABLED=true
GEMINI_API_KEY=...
GEMINI_CHAT_MODEL=gemini/gemini-1.5-flash

GROQ_ENABLED=true
GROQ_API_KEY=gsk_...
GROQ_CHAT_MODEL=groq/llama-3.1-8b-instant

OPENROUTER_ENABLED=true
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_CHAT_MODEL=openrouter/meta-llama/llama-3.1-8b-instruct
```

For a hosted chat model but local memory embeddings, keep:

```env
LITELLM_DEFAULT_CHAT_MODEL=openai-default
LITELLM_DEFAULT_EMBED_MODEL=local-embeddings
```

For hosted chat and hosted embeddings, add an embedding alias to `.local/litellm/config.yaml` or extend `scripts/litellm-env.sh`.

## Use OpenAI-Compatible Without LiteLLM

If you already have an OpenAI-compatible endpoint, the collector can call it directly:

```env
AI_PROVIDER=openai-compatible
AI_CHAT_BASE_URL=https://ai.example.com/v1
AI_CHAT_API_KEY=replace-with-key
AI_CHAT_MODEL=gpt-4o-mini
AI_EMBEDDING_BASE_URL=https://ai.example.com/v1
AI_EMBEDDING_API_KEY=replace-with-key
AI_EMBEDDING_MODEL=text-embedding-3-small
```

Restart the collector after changing these values:

```bash
npm run modular:collector:up
```

## Disable AI

For the smallest possible collector-only path:

```env
AI_ENABLED=false
AI_PROVIDER=fallback
```

The collector still stores events in Supabase and creates deterministic fallback insights. If Qdrant is enabled but no embedding provider is available, `QDRANT_FALLBACK_EMBEDDINGS=true` lets memory storage continue with deterministic local embeddings.

## Logs And Reset

```bash
npm run logs:litellm
npm run modular:litellm:down
RESET_LOCAL_DATA=true npm run reset:local
```

`RESET_MODE=data` removes LiteLLM Postgres data. `RESET_MODE=all` also removes `.local/litellm` and generated LiteLLM secrets.
