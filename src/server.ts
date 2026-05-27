import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config.js";
import { requireApiKey } from "./security.js";
import {
  normalizeGeneric,
  normalizeGlitchTip,
  normalizeListmonk,
  normalizeUmami,
  normalizeUptimeKuma,
  normalizeZammad
} from "./normalizers.js";
import { getSimilarContext, storeAction, storeEvent, storeFeedback, storeInsight } from "./supabase.js";
import { analyzeEvent, currentAiModel, setProviderOverride, getProviderOverride, applyConfigOverrides, getConfigOverrides } from "./ollama.js";
import { rememberEvent, searchMemory } from "./qdrant.js";
import { triggerAutomation } from "./automation.js";
import { sendNotifications, applyNotificationOverrides, getNotificationOverrides } from "./notifications.js";
import type { NormalizedEvent } from "./types.js";
import { actionSchema, feedbackSchema, memorySearchSchema, similarContextQuerySchema } from "./validation.js";
import type { AiInsight } from "./ollama.js";

const app = Fastify({
  logger: true,
  bodyLimit: 1024 * 1024 * 5
});

await app.register(cors, {
  origin: true
});

await app.register(helmet);

function publicInsight(insight: AiInsight) {
  if (config.DEBUG_AI_RAW) {
    return insight;
  }

  const { raw: _raw, ...cleanInsight } = insight;
  return cleanInsight;
}

app.get("/", async () => {
  return {
    ok: true,
    service: "redu-os-collector",
    health: "/health",
    events: "/v1/events",
    context: "/v1/context/similar",
    memory: "/v1/memory/search"
  };
});

app.get("/health", async () => {
  return {
    ok: true,
    service: "redu-os-collector",
    version: "0.1.0"
  };
});

// ── Runtime config (API-key protected) ──────────────────────────────────────
const VALID_PROVIDERS = ["ollama", "litellm", "openai-compatible", "fallback"] as const;

app.get("/internal/config", async (request) => {
  requireApiKey(request);
  const ov = getConfigOverrides();
  const nOv = getNotificationOverrides();
  return {
    ok: true,
    ai_provider: ov.ai_provider ?? config.AI_PROVIDER,
    overrides: ov,
    notifications: {
      discord:  { configured: !!(nOv.discord_webhook_url  ?? config.DISCORD_WEBHOOK_URL) },
      slack:    { configured: !!(nOv.slack_webhook_url    ?? config.SLACK_WEBHOOK_URL) },
      telegram: {
        configured: !!((nOv.telegram_bot_token ?? config.TELEGRAM_BOT_TOKEN) &&
                       (nOv.telegram_chat_id   ?? config.TELEGRAM_CHAT_ID)),
        chat_id: (nOv.telegram_chat_id ?? config.TELEGRAM_CHAT_ID) || null
      }
    }
  };
});

app.post("/internal/config", async (request) => {
  requireApiKey(request);
  const body = request.body as {
    ai_provider?: string;
    ai_chat_model?: string;
    ai_chat_base_url?: string;
    ai_chat_api_key?: string;
    ollama_model?: string;
    ollama_embed_model?: string;
    // Notifications
    discord_webhook_url?: string;
    slack_webhook_url?: string;
    telegram_bot_token?: string;
    telegram_chat_id?: string;
  };

  // Validate provider if provided
  if (body.ai_provider !== undefined) {
    if (!VALID_PROVIDERS.includes(body.ai_provider as typeof VALID_PROVIDERS[number])) {
      throw new Error(`Invalid ai_provider. Valid values: ${VALID_PROVIDERS.join(", ")}`);
    }
    // null override = use env default
    setProviderOverride(body.ai_provider === config.AI_PROVIDER ? null : body.ai_provider);
  }

  // Apply all other field overrides (empty string = clear override)
  applyConfigOverrides({
    ai_chat_model:    body.ai_chat_model    !== undefined ? (body.ai_chat_model    || null) : undefined,
    ai_chat_base_url: body.ai_chat_base_url !== undefined ? (body.ai_chat_base_url || null) : undefined,
    ai_chat_api_key:  body.ai_chat_api_key  !== undefined ? (body.ai_chat_api_key  || null) : undefined,
    ollama_model:     body.ollama_model     !== undefined ? (body.ollama_model     || null) : undefined,
    ollama_embed_model: body.ollama_embed_model !== undefined ? (body.ollama_embed_model || null) : undefined,
  });

  // Apply notification overrides
  applyNotificationOverrides({
    discord_webhook_url: body.discord_webhook_url !== undefined ? (body.discord_webhook_url || null) : undefined,
    slack_webhook_url:   body.slack_webhook_url   !== undefined ? (body.slack_webhook_url   || null) : undefined,
    telegram_bot_token:  body.telegram_bot_token  !== undefined ? (body.telegram_bot_token  || null) : undefined,
    telegram_chat_id:    body.telegram_chat_id    !== undefined ? (body.telegram_chat_id    || null) : undefined,
  });

  const ov = getConfigOverrides();
  return { ok: true, ai_provider: ov.ai_provider ?? config.AI_PROVIDER, overrides: ov, notifications: getNotificationOverrides() };
});

app.post("/internal/notifications/test", async (request) => {
  requireApiKey(request);
  const { channel } = request.body as { channel?: string };
  if (!channel || !["discord", "slack", "telegram"].includes(channel)) {
    throw new Error("channel must be one of: discord, slack, telegram");
  }
  const { testNotification } = await import("./notifications.js");
  const result = await testNotification(channel as "discord" | "slack" | "telegram");
  return { ok: result.ok, status: result.status };
});

async function handleEvent(event: NormalizedEvent) {
  const stored = await storeEvent(event);
  const insight = await analyzeEvent(stored);

  let storedInsight = null;
  try {
    storedInsight = await storeInsight({
      startup_event_id: stored.id,
      category: insight.category,
      priority: insight.priority,
      sentiment: insight.sentiment,
      summary: insight.summary,
      recommended_action: insight.recommended_action,
      ai_model: config.AI_ENABLED ? currentAiModel() : "fallback",
      raw: insight.raw
    });
  } catch (error) {
    app.log.error({ error }, "Failed to store insight");
  }

  const memory = await rememberEvent(stored);
  const automation = await triggerAutomation(stored, insight);
  const notifications = await sendNotifications(stored, insight);
  let storedAction = null;

  if (config.AUTOMATION_WEBHOOK_URL || config.AUTOMATION_WEBHOOK_URLS) {
    try {
      storedAction = await storeAction({
        startup_event_id: stored.id,
        ai_insight_id: storedInsight?.id ?? null,
        action_type: "trigger_automation_webhook",
        status: automation.sent ? "completed" : "failed",
        target: "activepieces",
        payload: {
          event_id: stored.id,
          insight_id: storedInsight?.id ?? null
        },
        result: automation,
        completed_at: new Date().toISOString()
      });
    } catch (error) {
      app.log.error({ error }, "Failed to store automation action");
    }
  }

  return {
    ok: true,
    event_id: stored.id,
    stored: true,
    insight_id: storedInsight?.id ?? null,
    action_id: storedAction?.id ?? null,
    memory,
    automation,
    notifications,
    insight: publicInsight(insight)
  };
}

app.post("/v1/events", async (request) => {
  requireApiKey(request);
  const event = normalizeGeneric(request.body);
  return handleEvent(event);
});

app.post("/v1/events/glitchtip", async (request) => {
  requireApiKey(request);
  const event = normalizeGlitchTip(request.body);
  return handleEvent(event);
});

app.post("/v1/events/zammad", async (request) => {
  requireApiKey(request);
  const event = normalizeZammad(request.body);
  return handleEvent(event);
});

app.post("/v1/events/uptime-kuma", async (request) => {
  requireApiKey(request);
  const event = normalizeUptimeKuma(request.body);
  return handleEvent(event);
});

app.post("/v1/events/umami", async (request) => {
  requireApiKey(request);
  const event = normalizeUmami(request.body);
  return handleEvent(event);
});

app.post("/v1/events/listmonk", async (request) => {
  requireApiKey(request);
  const event = normalizeListmonk(request.body);
  return handleEvent(event);
});

app.post("/v1/actions", async (request) => {
  requireApiKey(request);
  const input = actionSchema.parse(request.body);
  const action = await storeAction(input);

  return {
    ok: true,
    action_id: action.id
  };
});

app.post("/v1/feedback", async (request) => {
  requireApiKey(request);
  const input = feedbackSchema.parse(request.body);
  const feedback = await storeFeedback(input);

  return {
    ok: true,
    feedback_id: feedback.id
  };
});

app.get("/v1/context/similar", async (request) => {
  requireApiKey(request);
  const input = similarContextQuerySchema.parse(request.query);
  const items = await getSimilarContext(input);

  return {
    ok: true,
    items
  };
});

app.post("/v1/memory/search", async (request) => {
  requireApiKey(request);
  const input = memorySearchSchema.parse(request.body);
  const result = await searchMemory(input);

  return {
    ok: result.searched,
    ...result
  };
});

app.setErrorHandler((error, request, reply) => {
  const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;
  const message = error instanceof Error ? error.message : String(error);

  request.log.error({ error }, "Request failed");

  reply.status(statusCode).send({
    ok: false,
    error: message
  });
});

await app.listen({
  host: "0.0.0.0",
  port: config.PORT
});
