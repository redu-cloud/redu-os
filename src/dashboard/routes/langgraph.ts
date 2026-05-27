import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { langgraphUrl, langgraphApiKey } from "../config.js";
import { traceDashboardAgentCall } from "../langfuse.js";

export function register(app: FastifyInstance): void {
  app.get("/api/langgraph/health", async (_request, reply) => {
    if (!langgraphUrl || !langgraphApiKey) {
      reply.status(503);
      return { ok: false, reason: "langgraph_not_configured" };
    }

    try {
      const response = await fetch(`${langgraphUrl}/health`, {
        headers: { "X-API-Key": langgraphApiKey }
      });
      const body = await response.json();
      reply.status(response.status);
      return body;
    } catch (error) {
      reply.status(503);
      return { ok: false, reason: error instanceof Error ? error.message : "connection_failed" };
    }
  });

  app.post("/api/langgraph/invoke", async (request, reply) => {
    if (!langgraphUrl || !langgraphApiKey) {
      reply.status(503);
      return { ok: false, error: "LangGraph is not configured. Set LANGGRAPH_URL and LANGGRAPH_API_KEY." };
    }

    const body = request.body as {
      mode?: string;
      severity?: string;
      message?: string;
      user_email?: string;
      record_to_collector?: boolean;
      trigger_automation?: boolean;
    };

    const mode = body.mode ?? "support";
    const agentPaths: Record<string, string> = {
      support: "/v1/agents/support",
      incident: "/v1/agents/incident",
      onboarding: "/v1/agents/onboarding",
      "product-signal": "/v1/agents/product-signal"
    };
    const path = agentPaths[mode] ?? "/v1/agents/support";

    const payload = {
      message: body.message ?? "",
      severity: body.severity ?? "medium",
      source: "dashboard",
      ...(body.user_email ? { user_email: body.user_email } : {}),
      record_to_collector: body.record_to_collector ?? false,
      trigger_automation: body.trigger_automation ?? false
    };

    const traceId = randomUUID();
    const startedAt = new Date();
    try {
      const response = await fetch(`${langgraphUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": langgraphApiKey
        },
        body: JSON.stringify(payload)
      });

      const responseBody = await response.json();
      const endedAt = new Date();

      // fire-and-forget — does not block the response
      traceDashboardAgentCall({
        traceId, mode, payload, response: responseBody,
        startedAt, endedAt, ok: response.ok
      }).catch(() => {});

      reply.status(response.status);
      return responseBody;
    } catch (error) {
      traceDashboardAgentCall({
        traceId, mode, payload, response: { error: String(error) },
        startedAt, endedAt: new Date(), ok: false
      }).catch(() => {});
      reply.status(503);
      return { ok: false, error: error instanceof Error ? error.message : "LangGraph connection failed" };
    }
  });
}
