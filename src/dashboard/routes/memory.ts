import type { FastifyInstance } from "fastify";
import { collectorUrl, collectorApiKey, jsonHeaders } from "../config.js";

export function register(app: FastifyInstance): void {
  app.post("/api/memory/search", async (request, reply) => {
    const body = request.body as { query?: string; limit?: number };
    const response = await fetch(`${collectorUrl}/v1/memory/search`, {
      method: "POST",
      headers: jsonHeaders(collectorApiKey),
      body: JSON.stringify({
        query: body.query || "customers blocked during onboarding",
        limit: body.limit ?? 5
      })
    });

    const data = await response.json() as { ok?: boolean; reason?: string; items?: unknown[] };
    if (data.reason === "qdrant_disabled") {
      return { ok: true, items: [], disabled: true };
    }
    reply.status(response.status);
    return data;
  });
}
