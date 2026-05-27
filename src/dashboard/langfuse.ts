import { randomUUID } from "node:crypto";
import { langfuseTracingEnabled, langfuseApiUrl, langfusePublicKey, langfuseSecretKey } from "./config.js";

/**
 * Fire-and-forget Langfuse trace for LangGraph agent calls from the dashboard.
 * Tagged with langfuse_module: "redu-os-dashboard" to distinguish from collector traces.
 */
export async function traceDashboardAgentCall(opts: {
  traceId: string;
  mode: string;
  payload: unknown;
  response: unknown;
  startedAt: Date;
  endedAt: Date;
  ok: boolean;
}): Promise<void> {
  if (!langfuseTracingEnabled) return;
  const token = Buffer.from(`${langfusePublicKey}:${langfuseSecretKey}`).toString("base64");
  try {
    await fetch(`${langfuseApiUrl}/api/public/ingestion`, {
      method: "POST",
      headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        batch: [{
          id: randomUUID(),
          type: "trace-create",
          timestamp: opts.startedAt.toISOString(),
          body: {
            id: opts.traceId,
            name: "reduos.dashboard.agent",
            input: opts.payload,
            output: opts.response,
            metadata: {
              agent_mode: opts.mode,
              ok: opts.ok,
              langfuse_module: "redu-os-dashboard",
              duration_ms: opts.endedAt.getTime() - opts.startedAt.getTime()
            },
            tags: ["reduos", "dashboard", "agent", opts.mode]
          }
        }]
      }),
      signal: AbortSignal.timeout(3000)
    });
  } catch {
    // fire-and-forget — tracing failures are silent
  }
}
