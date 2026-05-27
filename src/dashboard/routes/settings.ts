import type { FastifyInstance } from "fastify";
import {
  toPublicUrl,
  toContainerUrl,
  ollamaUrl,
  collectorUrl,
  collectorApiKey,
  supabaseUrl,
  studioUrl,
  qdrantUrl,
  activepiecesUrl,
  langgraphUrl,
  litellmUrl,
  litellmMasterKey,
  uptimeKumaUrl,
  glitchtipUrl,
  listmonkUrl,
  zammadUrl,
  langfuseUrl,
  umamiPublicUrl,
  authEnabled,
  jsonHeaders
} from "../config.js";

const VALID_PROVIDERS = ["ollama", "litellm", "openai-compatible", "fallback"] as const;

export function register(app: FastifyInstance): void {
  // POST /api/ai-config/provider — switch AI provider at runtime (propagates to collector)
  app.post("/api/ai-config/provider", async (request) => {
    const { provider } = request.body as { provider?: string };
    if (!provider || !VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
      throw new Error(`Invalid provider. Valid: ${VALID_PROVIDERS.join(", ")}`);
    }
    const res = await fetch(`${collectorUrl}/internal/config`, {
      method: "POST",
      headers: jsonHeaders(collectorApiKey),
      body: JSON.stringify({ ai_provider: provider })
    });
    if (!res.ok) {
      throw new Error(`Collector config update failed: ${res.status}`);
    }
    // Mirror change in dashboard process env for consistent display
    process.env.AI_PROVIDER = provider;
    const data = await res.json() as { ai_provider: string };
    return { ok: true, provider: data.ai_provider };
  });

  app.get("/api/ai-config", async () => {
    // Fetch runtime overrides from collector so display reflects what's actually active
    let collectorOverrides: Record<string, unknown> = {};
    try {
      const r = await fetch(`${collectorUrl}/internal/config`, { headers: jsonHeaders(collectorApiKey) });
      if (r.ok) { const d = await r.json() as { overrides?: Record<string, unknown> }; collectorOverrides = d.overrides ?? {}; }
    } catch { /* ignore — collector may be starting */ }

    const provider = (collectorOverrides.ai_provider as string) ?? process.env.AI_PROVIDER ?? "fallback";
    const aiEnabled = process.env.AI_ENABLED === "true";
    const qdrantEnabled = process.env.QDRANT_ENABLED === "true";
    const langfuseEnabled = process.env.LANGFUSE_ENABLED === "true";

    return {
      ok: true,
      ai_enabled: aiEnabled,
      ai_provider: provider,
      qdrant_enabled: qdrantEnabled,
      langfuse_enabled: langfuseEnabled,
      langfuse_host: process.env.LANGFUSE_HOST ?? null,
      langfuse_public_key: process.env.LANGFUSE_PUBLIC_KEY ? "••••••" : null,
      ollama: {
        url: toPublicUrl(ollamaUrl),
        chat_model: (collectorOverrides.ollama_model as string) ?? process.env.OLLAMA_MODEL ?? "deepseek-r1:1.5b",
        embed_model: (collectorOverrides.ollama_embed_model as string) ?? process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text"
      },
      litellm: {
        // Always return public-facing URL so the browser can display/compare it
        base_url: toPublicUrl((collectorOverrides.ai_chat_base_url as string) ?? process.env.AI_CHAT_BASE_URL ?? ""),
        model:    (collectorOverrides.ai_chat_model as string)    ?? (process.env.AI_CHAT_MODEL    || null),
        api_key_set: !!(collectorOverrides.ai_chat_api_key ?? process.env.AI_CHAT_API_KEY)
      }
    };
  });

  // PATCH /api/ai-config — update model / key / URL overrides at runtime
  app.patch("/api/ai-config", async (request) => {
    const body = request.body as {
      ai_chat_model?: string;
      ai_chat_base_url?: string;
      ai_chat_api_key?: string;
      ollama_model?: string;
      ollama_embed_model?: string;
    };

    // Convert any localhost/127.0.0.1 base URL → host.containers.internal for the collector
    const collectorBody = {
      ...body,
      ...(body.ai_chat_base_url !== undefined
        ? { ai_chat_base_url: toContainerUrl(body.ai_chat_base_url, "") }
        : {})
    };

    const res = await fetch(`${collectorUrl}/internal/config`, {
      method: "POST",
      headers: jsonHeaders(collectorApiKey),
      body: JSON.stringify(collectorBody)
    });
    if (!res.ok) throw new Error(`Collector config update failed: ${res.status}`);

    // Mirror in dashboard process.env (keep public-facing URLs)
    if (body.ai_chat_model      !== undefined) process.env.AI_CHAT_MODEL      = body.ai_chat_model;
    if (body.ai_chat_base_url   !== undefined) process.env.AI_CHAT_BASE_URL   = body.ai_chat_base_url;
    if (body.ai_chat_api_key    !== undefined) process.env.AI_CHAT_API_KEY    = body.ai_chat_api_key;
    if (body.ollama_model       !== undefined) process.env.OLLAMA_MODEL       = body.ollama_model;
    if (body.ollama_embed_model !== undefined) process.env.OLLAMA_EMBED_MODEL = body.ollama_embed_model;

    return { ok: true };
  });

  // GET /api/ai-config/ollama-models — list models installed in Ollama, split by role
  app.get("/api/ai-config/ollama-models", async () => {
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (!res.ok) return { ok: false, chat: [], embed: [] };
      const data = await res.json() as { models?: Array<{ name: string; details?: { family?: string } }> };
      const all = data.models ?? [];
      // Embedding models: nomic-bert family or name contains "embed"
      const isEmbed = (m: { name: string; details?: { family?: string } }) =>
        (m.details?.family ?? "").toLowerCase().includes("nomic-bert") ||
        m.name.toLowerCase().includes("embed");
      const chat  = all.filter(m => !isEmbed(m)).map(m => m.name);
      const embed = all.filter(m =>  isEmbed(m)).map(m => m.name);
      return { ok: true, chat, embed };
    } catch {
      return { ok: false, chat: [], embed: [] };
    }
  });

  // GET /api/ai-config/litellm-models — list models from LiteLLM + curated cloud models
  app.get("/api/ai-config/litellm-models", async () => {
    // Fetch configured models from LiteLLM
    let localModels: string[] = [];
    try {
      const url = litellmUrl || toContainerUrl("http://localhost:4000", "");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (litellmMasterKey) headers["Authorization"] = `Bearer ${litellmMasterKey}`;
      const res = await fetch(`${url}/models`, { headers });
      if (res.ok) {
        const data = await res.json() as { data?: Array<{ id: string }> };
        localModels = (data.data ?? []).map(m => m.id).filter(id => !id.includes("embed"));
      }
    } catch { /* LiteLLM may be unavailable */ }

    return {
      ok: true,
      groups: [
        ...(localModels.length ? [{ label: "LiteLLM (Configured)", models: localModels }] : []),
        { label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
        { label: "Anthropic", models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
        { label: "Google", models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"] },
        { label: "Groq", models: ["groq/llama-3.3-70b-versatile", "groq/llama-3.1-8b-instant", "groq/gemma2-9b-it"] },
        { label: "OpenRouter", models: ["openrouter/anthropic/claude-3.5-sonnet", "openrouter/openai/gpt-4o", "openrouter/meta-llama/llama-3.3-70b-instruct"] },
      ]
    };
  });

  app.get("/api/settings", async () => {
    // Build service URLs map — only include services that are configured
    const serviceUrls: Record<string, string> = {
      collector:       toPublicUrl(collectorUrl),
      supabase_api:    toPublicUrl(supabaseUrl),
      supabase_studio: toPublicUrl(studioUrl),
      qdrant:          toPublicUrl(qdrantUrl),
      ollama:          toPublicUrl(ollamaUrl),
      activepieces:    toPublicUrl(activepiecesUrl),
    };
    if (langgraphUrl)    serviceUrls.langgraph    = toPublicUrl(langgraphUrl);
    if (litellmUrl)      serviceUrls.litellm      = toPublicUrl(litellmUrl);
    if (langfuseUrl)     serviceUrls.langfuse     = toPublicUrl(langfuseUrl);
    if (uptimeKumaUrl)   serviceUrls.uptime_kuma  = toPublicUrl(uptimeKumaUrl);
    if (umamiPublicUrl)  serviceUrls.umami        = umamiPublicUrl;
    if (glitchtipUrl)    serviceUrls.glitchtip    = toPublicUrl(glitchtipUrl);
    if (listmonkUrl)     serviceUrls.listmonk     = toPublicUrl(listmonkUrl);
    if (zammadUrl)       serviceUrls.zammad       = toPublicUrl(zammadUrl);

    return {
      ok: true,
      instance: {
        name: process.env.INSTANCE_NAME ?? "reduOS",
        version: "0.1.0",
        dashboard_auth_enabled: authEnabled
      },
      features: {
        ai_enabled:        process.env.AI_ENABLED === "true",
        qdrant_enabled:    process.env.QDRANT_ENABLED === "true",
        langfuse_enabled:  process.env.LANGFUSE_ENABLED === "true",
        automation_enabled: !!(process.env.AUTOMATION_WEBHOOK_URL || process.env.AUTOMATION_WEBHOOK_URLS),
        litellm_enabled:   process.env.AI_PROVIDER === "litellm" && !!(process.env.AI_CHAT_BASE_URL),
        langgraph_enabled: !!(langgraphUrl),
        uptime_kuma_enabled: !!(uptimeKumaUrl),
        umami_enabled:     !!(umamiPublicUrl),
        glitchtip_enabled: !!(glitchtipUrl),
        listmonk_enabled:  !!(listmonkUrl),
        zammad_enabled:    !!(zammadUrl),
      },
      urls: serviceUrls,
      api_key_hint: collectorApiKey && collectorApiKey !== "change-me-please"
        ? `${collectorApiKey.slice(0, 4)}${"•".repeat(Math.max(0, collectorApiKey.length - 8))}${collectorApiKey.slice(-4)}`
        : "not configured"
    };
  });
}
