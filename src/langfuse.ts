import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { StoredEvent } from "./types.js";
import type { AiInsight } from "./ollama.js";

type TraceInput = {
  event: StoredEvent;
  prompt: string;
  insight: AiInsight;
  rawResponse: unknown;
  startedAt: Date;
  endedAt: Date;
  error?: string;
  provider: string;
  model: string;
  baseUrl: string;
};

function canTrace() {
  return Boolean(
    config.LANGFUSE_ENABLED &&
    config.LANGFUSE_HOST &&
    config.LANGFUSE_PUBLIC_KEY &&
    config.LANGFUSE_SECRET_KEY
  );
}

function authHeader() {
  const token = Buffer.from(`${config.LANGFUSE_PUBLIC_KEY}:${config.LANGFUSE_SECRET_KEY}`).toString("base64");
  return `Basic ${token}`;
}

export async function traceAiGeneration(input: TraceInput) {
  if (!canTrace()) {
    return { sent: false, reason: "langfuse_disabled" };
  }

  const generationId = randomUUID();
  const traceId = input.event.id;
  const status = input.error ? "ERROR" : "DEFAULT";

  const body = {
    batch: [
      {
        id: randomUUID(),
        type: "trace-create",
        timestamp: input.startedAt.toISOString(),
        body: {
          id: traceId,
          name: "reduos.event.analysis",
          userId: input.event.user_email ?? undefined,
          sessionId: input.event.source,
          input: input.event,
          output: {
            category: input.insight.category,
            priority: input.insight.priority,
            sentiment: input.insight.sentiment,
            summary: input.insight.summary,
            recommended_action: input.insight.recommended_action
          },
          metadata: {
            event_id: input.event.id,
            event_type: input.event.type,
            source: input.event.source,
            severity: input.event.severity,
            langfuse_module: "redu-os-collector"
          },
          tags: ["reduos", input.event.source, input.event.type]
        }
      },
      {
        id: randomUUID(),
        type: "generation-create",
        timestamp: input.startedAt.toISOString(),
        body: {
          id: generationId,
          traceId,
          name: `${input.provider}.generate.insight`,
          model: input.model,
          startTime: input.startedAt.toISOString(),
          endTime: input.endedAt.toISOString(),
          input: input.prompt,
          output: input.rawResponse ?? input.insight,
          level: status,
          statusMessage: input.error,
          metadata: {
            event_id: input.event.id,
            ai_provider: input.provider,
            ai_base_url: input.baseUrl,
            ai_enabled: config.AI_ENABLED,
            duration_ms: input.endedAt.getTime() - input.startedAt.getTime()
          }
        }
      }
    ],
    metadata: {
      source: "redu-os-collector"
    }
  };

  try {
    const response = await fetch(`${config.LANGFUSE_HOST.replace(/\/$/, "")}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "Authorization": authHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.LANGFUSE_TIMEOUT_MS)
    });

    if (!response.ok && response.status !== 207) {
      return { sent: false, reason: `langfuse_http_${response.status}` };
    }

    return { sent: true, trace_id: traceId, generation_id: generationId };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
