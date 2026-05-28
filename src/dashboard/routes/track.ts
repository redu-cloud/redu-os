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

  app.post("/api/track", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");

    const body = request.body as Record<string, unknown> ?? {};
    // Default source to "website" if not set
    if (!body.source) body.source = "website";

    // Fire-and-forget: the full AI loop takes ~15s; the browser doesn't need to wait.
    fetch(`${collectorUrl}/v1/events`, {
      method:  "POST",
      headers: jsonHeaders(collectorApiKey),
      body:    JSON.stringify(body),
    }).catch(() => {});

    return { ok: true };
  });
}
