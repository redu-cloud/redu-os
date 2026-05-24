import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { config } from "./config.js";
import { requireApiKey } from "./security.js";
import {
  normalizeGeneric,
  normalizeGlitchTip,
  normalizeUmami,
  normalizeUptimeKuma,
  normalizeZammad
} from "./normalizers.js";
import { getSimilarContext, storeAction, storeEvent, storeFeedback, storeInsight } from "./supabase.js";
import { analyzeEvent } from "./ollama.js";
import { rememberEvent, searchMemory } from "./qdrant.js";
import { triggerAutomation } from "./automation.js";
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
      ai_model: config.AI_ENABLED ? config.OLLAMA_MODEL : "fallback",
      raw: insight.raw
    });
  } catch (error) {
    app.log.error({ error }, "Failed to store insight");
  }

  const memory = await rememberEvent(stored);
  const automation = await triggerAutomation(stored, insight);
  let storedAction = null;

  if (config.AUTOMATION_WEBHOOK_URL) {
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
