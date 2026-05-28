import type { FastifyRequest } from "fastify";
import { config } from "./config.js";

export function requireApiKey(request: FastifyRequest): void {
  // Accept key from: X-API-Key header, Authorization header, or ?key= query param
  // (query param allows services that don't support custom headers to embed the key in the URL)
  const fromHeader =
    request.headers["x-api-key"] ||
    request.headers["x-redu-api-key"] ||
    request.headers["authorization"];

  const headerVal = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
  const fromQuery = (request.query as Record<string, string>)["key"];

  const raw = headerVal || fromQuery;
  const normalized = raw?.startsWith("Bearer ") ? raw.slice("Bearer ".length) : raw;

  if (!normalized || normalized !== config.COLLECTOR_API_KEY) {
    const error = new Error("Invalid or missing API key");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}
