/**
 * POST /api/track  — public event proxy with CORS
 *
 * Allows websites to send events to the collector without exposing the
 * collector API key or worrying about CORS. The dashboard acts as the
 * authenticated proxy.
 *
 * This route is excluded from session-cookie auth (see auth.ts publicPaths).
 */
import type { FastifyInstance } from "fastify";
import { collectorUrl, collectorApiKey, jsonHeaders } from "../config.js";

export function register(app: FastifyInstance): void {
  // Handle CORS pre-flight
  app.options("/api/track", (_, reply) => {
    reply
      .header("Access-Control-Allow-Origin",  "*")
      .header("Access-Control-Allow-Methods", "POST, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type")
      .status(204)
      .send();
  });

  app.post("/api/track", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");

    const body = request.body as Record<string, unknown> ?? {};
    // Default source to "website" if not set
    if (!body.source) body.source = "website";

    try {
      const res = await fetch(`${collectorUrl}/v1/events`, {
        method:  "POST",
        headers: jsonHeaders(collectorApiKey),
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(6_000)
      });
      const data = await res.json();
      reply.status(res.status);
      return data;
    } catch {
      reply.status(502);
      return { ok: false, error: "collector_unreachable" };
    }
  });
}
