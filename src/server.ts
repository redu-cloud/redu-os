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
import { autoFeedbackOnErrorResolved, autoFeedbackOnRecovery, autoFeedbackOnTicketResolved, autoFeedbackOnUnsubscribe, getSimilarContext, storeAction, storeEvent, storeFeedback, storeInsight, supabase } from "./supabase.js";
import { analyzeEvent, currentAiModel, setProviderOverride, getProviderOverride, applyConfigOverrides, getConfigOverrides, getApprovalSeverity } from "./ollama.js";
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

// ── Approval severity threshold ──────────────────────────────────────────────
const SEVERITY_ORDER = ["debug", "info", "low", "medium", "high", "critical"] as const;

function requiresApproval(eventSeverity: string): boolean {
  const threshold = getApprovalSeverity();
  if (!threshold) return false;
  if (threshold === "all") return true;
  const ti = SEVERITY_ORDER.indexOf(threshold as typeof SEVERITY_ORDER[number]);
  const ei = SEVERITY_ORDER.indexOf(eventSeverity as typeof SEVERITY_ORDER[number]);
  return ti !== -1 && ei !== -1 && ei >= ti;
}

// ── Runtime config (API-key protected) ──────────────────────────────────────
const VALID_PROVIDERS = ["ollama", "litellm", "openai-compatible", "fallback"] as const;

app.get("/internal/config", async (request) => {
  requireApiKey(request);
  const ov = getConfigOverrides();
  const nOv = getNotificationOverrides();
  return {
    ok: true,
    ai_provider: ov.ai_provider ?? config.AI_PROVIDER,
    require_approval_severity: ov.require_approval_severity ?? config.REQUIRE_APPROVAL_SEVERITY ?? null,
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
    require_approval_severity?: string;
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
    require_approval_severity: body.require_approval_severity !== undefined ? (body.require_approval_severity || null) : undefined,
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

// Approve a pending_approval action — looks up the stored event + insight and fires automation
app.post("/internal/actions/:id/approve", async (request) => {
  requireApiKey(request);
  const { id } = request.params as { id: string };

  const { data: action, error: ae } = await supabase.from("ai_actions").select("*").eq("id", id).single();
  if (ae || !action) throw new Error("Action not found");
  if ((action as { status: string }).status !== "pending_approval") {
    throw new Error(`Action is not pending approval (status: ${(action as { status: string }).status})`);
  }

  const { data: storedEvent } = await supabase
    .from("startup_events").select("*")
    .eq("id", (action as { startup_event_id: string }).startup_event_id).single();
  if (!storedEvent) throw new Error("Associated event not found");

  const { data: insightRows } = await supabase
    .from("ai_insights").select("*")
    .eq("startup_event_id", (action as { startup_event_id: string }).startup_event_id)
    .order("created_at", { ascending: false }).limit(1);
  const insight = (insightRows as null | Array<{ category: string; priority: string; sentiment: string; summary: string; recommended_action: string }>)?.[0];

  const aiInsight = insight
    ? { category: insight.category, priority: insight.priority as "Low" | "Medium" | "High", sentiment: insight.sentiment as "Negative" | "Neutral" | "Positive", summary: insight.summary, recommended_action: insight.recommended_action }
    : { category: "General", priority: "Medium" as const, sentiment: "Neutral" as const, summary: (storedEvent as { message: string }).message, recommended_action: "Review and take appropriate action" };

  const callbackUrl = `http://host.containers.internal:${config.PORT}/v1/feedback/action-result`;
  const automation = await triggerAutomation(storedEvent as import("./types.js").StoredEvent, aiInsight, {
    action_id: (action as { id: string }).id,
    callback_url: callbackUrl
  });

  await supabase.from("ai_actions").update({
    status: automation.sent ? "triggered" : "failed",
    result: automation,
    completed_at: new Date().toISOString()
  }).eq("id", id);

  return { ok: true, automation };
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

  const needsApproval = requiresApproval(event.severity);

  // Pre-create the action record so we can pass its id to Activepieces for callback attribution
  let storedAction = null;
  if (config.AUTOMATION_WEBHOOK_URL || config.AUTOMATION_WEBHOOK_URLS) {
    try {
      storedAction = await storeAction({
        startup_event_id: stored.id,
        ai_insight_id: storedInsight?.id ?? null,
        action_type: "trigger_automation_webhook",
        status: needsApproval ? "pending_approval" : "pending",
        target: "activepieces",
        payload: { event_id: stored.id, insight_id: storedInsight?.id ?? null },
        result: {},
        completed_at: null
      });
    } catch (error) {
      app.log.error({ error }, "Failed to pre-store automation action");
    }
  }

  let automation: Awaited<ReturnType<typeof triggerAutomation>> | { sent: false; reason: string };
  if (needsApproval) {
    automation = { sent: false, reason: "pending_approval" };
  } else {
    const callbackUrl = `http://host.containers.internal:${config.PORT}/v1/feedback/action-result`;
    automation = await triggerAutomation(stored, insight, {
      action_id: storedAction?.id ?? null,
      callback_url: callbackUrl
    });

    if (storedAction) {
      try {
        await supabase
          .from("ai_actions")
          .update({ status: automation.sent ? "completed" : "failed", result: automation, completed_at: new Date().toISOString() })
          .eq("id", storedAction.id);
      } catch (error) {
        app.log.error({ error }, "Failed to update automation action status");
      }
    }
  }

  const notifications = await sendNotifications(stored, insight);

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
  const result = await handleEvent(event);

  if (event.source === "glitchtip" && event.type === "error.resolved") {
    const issueId = (event.metadata as Record<string, unknown>)?.glitchtip_issue_id;
    if (typeof issueId === "string" && result.event_id) {
      autoFeedbackOnErrorResolved(issueId, result.event_id, new Date()).catch((err) => {
        app.log.warn({ err }, "auto-feedback on error resolution failed");
      });
    }
  }

  if (event.source === "listmonk" && event.type === "audience.subscriber.unsubscribed") {
    const email = event.user_email;
    if (email && result.event_id) {
      autoFeedbackOnUnsubscribe(email, result.event_id, new Date()).catch((err) => {
        app.log.warn({ err }, "auto-feedback on unsubscribe failed");
      });
    }
  }

  return result;
});

app.post("/v1/events/glitchtip", async (request) => {
  requireApiKey(request);
  const event = normalizeGlitchTip(request.body);
  return handleEvent(event);
});

app.post("/v1/events/zammad", async (request) => {
  requireApiKey(request);
  const event = normalizeZammad(request.body);
  const result = await handleEvent(event);

  if (event.type === "support.ticket.resolved") {
    const ticketId = (event.metadata as Record<string, unknown>)?.ticket_id;
    if (ticketId != null && result.event_id) {
      autoFeedbackOnTicketResolved(String(ticketId), result.event_id, new Date()).catch((err) => {
        app.log.warn({ err }, "auto-feedback on ticket resolution failed");
      });
    }
  }

  return result;
});

app.post("/v1/events/uptime-kuma", async (request) => {
  requireApiKey(request);
  const event = normalizeUptimeKuma(request.body);
  const result = await handleEvent(event);

  if (event.type === "uptime.monitor.recovered") {
    const monitorName = (event.metadata as Record<string, unknown>)?.monitor_name;
    if (typeof monitorName === "string" && result.event_id) {
      autoFeedbackOnRecovery(monitorName, result.event_id, new Date()).catch((err) => {
        app.log.warn({ err }, "auto-feedback on recovery failed");
      });
    }
  }

  return result;
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

// Called by Activepieces (or any automation tool) after completing an action.
// Records what was done and creates a feedback entry for AI context.
app.post("/v1/feedback/action-result", async (request) => {
  requireApiKey(request);
  const body = request.body as Record<string, unknown>;
  const actionId = typeof body.action_id === "string" ? body.action_id : null;
  const eventId = typeof body.event_id === "string" ? body.event_id : null;
  const actionTaken = typeof body.action_taken === "string" ? body.action_taken : "automation_completed";
  const outcome = typeof body.outcome === "string" ? body.outcome : "completed";
  const meta = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {};

  if (!eventId && !actionId) {
    return { ok: false, error: "event_id or action_id required" };
  }

  // Update the action record if we have an id
  if (actionId) {
    await supabase
      .from("ai_actions")
      .update({ status: "completed", result: { action_taken: actionTaken, outcome, ...meta as object }, completed_at: new Date().toISOString() })
      .eq("id", actionId);
  }

  // Resolve event_id from action if not provided directly
  let resolvedEventId = eventId;
  if (!resolvedEventId && actionId) {
    const { data } = await supabase.from("ai_actions").select("startup_event_id").eq("id", actionId).single();
    resolvedEventId = (data as { startup_event_id: string } | null)?.startup_event_id ?? null;
  }

  const feedback = resolvedEventId
    ? await storeFeedback({
        startup_event_id: resolvedEventId,
        ai_action_id: actionId,
        feedback_type: "automation_result",
        score: outcome === "failed" ? -1 : 1,
        result: outcome,
        metadata: { action_taken: actionTaken, ...meta as object }
      })
    : null;

  return { ok: true, feedback_id: feedback?.id ?? null };
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
