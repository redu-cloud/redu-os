# AI Provider Modes

The collector supports four AI modes.

## Local Ollama

This is the smallest complete private tier.

```env
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11435
OLLAMA_MODEL=deepseek-r1:1.5b
OLLAMA_EMBED_MODEL=nomic-embed-text
```

In the same-machine container stack, the collector receives the container-safe Ollama URL automatically.

## LiteLLM Gateway

Use this when you want one collector contract and many possible model backends.

```env
AI_ENABLED=true
AI_PROVIDER=litellm
AI_CHAT_BASE_URL=http://host.containers.internal:4000/v1
AI_CHAT_API_KEY=sk-generated-local-key
AI_CHAT_MODEL=local-deepseek
AI_EMBEDDING_BASE_URL=http://host.containers.internal:4000/v1
AI_EMBEDDING_API_KEY=sk-generated-local-key
AI_EMBEDDING_MODEL=local-embeddings
```

Start it with:

```bash
npm run modular:litellm:up
```

## Direct OpenAI-Compatible

Use this when a team already has a managed AI gateway.

```env
AI_ENABLED=true
AI_PROVIDER=openai-compatible
AI_CHAT_BASE_URL=https://ai.example.com/v1
AI_CHAT_API_KEY=replace-with-key
AI_CHAT_MODEL=gpt-4o-mini
AI_EMBEDDING_BASE_URL=https://ai.example.com/v1
AI_EMBEDDING_API_KEY=replace-with-key
AI_EMBEDDING_MODEL=text-embedding-3-small
```

## Fallback

Use this when the collector should avoid model calls.

```env
AI_ENABLED=false
AI_PROVIDER=fallback
```

Fallback mode still stores events and creates basic operational insights from event type, severity, and message text.

## Choosing A Mode

Use `ollama` when privacy and simple local operation matter most.

Use `litellm` when you want local AI today but the option to switch some tenants, environments, or workflows to paid hosted models later.

Use `openai-compatible` when another service already owns model routing, keys, budgets, or policy.

Use `fallback` for very small deployments, tests, or degraded mode.
