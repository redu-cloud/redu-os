import type { FastifyRequest } from "fastify";
import { config } from "./config.js";

export function requireApiKey(request: FastifyRequest): void {
  const provided =
    request.headers["x-api-key"] ||
    request.headers["x-redu-api-key"] ||
    request.headers["authorization"];

  const value = Array.isArray(provided) ? provided[0] : provided;

  const normalized = value?.startsWith("Bearer ")
    ? value.slice("Bearer ".length)
    : value;

  if (!normalized || normalized !== config.COLLECTOR_API_KEY) {
    const error = new Error("Invalid or missing API key");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}
