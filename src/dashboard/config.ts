import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".local/supabase-local.env" });

export const port = Number(process.env.DASHBOARD_PORT ?? 3006);

// Running in a container: translate host URLs (127.0.0.1 or localhost) to host.containers.internal
export function toContainerUrl(url: string | undefined, fallback: string): string {
  return (url ?? fallback)
    .replace("://127.0.0.1", "://host.containers.internal")
    .replace("://localhost", "://host.containers.internal");
}

// Reverse: turn a container-internal URL back into a browser-accessible one (localhost)
export function toPublicUrl(containerUrl: string): string {
  return containerUrl.replace("host.containers.internal", "localhost");
}

export const collectorUrl = toContainerUrl(process.env.COLLECTOR_URL, "http://host.containers.internal:3005");
export const collectorApiKey = process.env.COLLECTOR_API_KEY ?? "change-me-please";
export const qdrantUrl = toContainerUrl(process.env.QDRANT_URL, "http://host.containers.internal:6333");
export const qdrantApiKey = process.env.QDRANT_API_KEY ?? "";
export const qdrantCollection = process.env.QDRANT_COLLECTION ?? "redu_os_events";
export const ollamaUrl = toContainerUrl(process.env.OLLAMA_URL, "http://host.containers.internal:11435");
export const supabaseUrl = toContainerUrl(process.env.SUPABASE_URL, "http://host.containers.internal:8000");
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const supabaseAnonKey = process.env.ANON_KEY ?? "";
export const activepiecesUrl = toContainerUrl(process.env.AP_FRONTEND_URL, "http://host.containers.internal:8080");
export const studioUrl = toContainerUrl(process.env.SUPABASE_STUDIO_URL, "http://host.containers.internal:3000");
export const langgraphUrl = toContainerUrl(process.env.LANGGRAPH_URL, "");
export const langgraphApiKey = process.env.LANGGRAPH_API_KEY ?? "";
export const litellmUrl = toContainerUrl(process.env.LITELLM_URL, "");
export const litellmMasterKey = process.env.LITELLM_MASTER_KEY ?? "";

// ── Optional module URLs (empty string = not configured) ──────────────────────
export const uptimeKumaUrl = toContainerUrl(process.env.UPTIME_KUMA_URL, "");
export const glitchtipUrl  = toContainerUrl(process.env.GLITCHTIP_URL, "");
// GlitchTip DSN for @sentry/node — rewrite host portion so container can reach GlitchTip
export const glitchtipDsn  = (() => {
  const raw = process.env.GLITCHTIP_DSN ?? "";
  if (!raw) return "";
  // DSN format: http://<key>@<host>:<port>/<project-id>
  // Replace 127.0.0.1 with host.containers.internal so the dashboard container can reach it
  return raw.replace("127.0.0.1", "host.containers.internal");
})();
export const listmonkUrl           = toContainerUrl(process.env.LISTMONK_URL, "");
export const listmonkAdminUsername = process.env.LISTMONK_ADMIN_USERNAME ?? "admin";
export const listmonkAdminPassword = process.env.LISTMONK_ADMIN_PASSWORD ?? "";
export const zammadUrl     = toContainerUrl(process.env.ZAMMAD_URL, "");
export const langfuseUrl   = toContainerUrl(process.env.LANGFUSE_URL, "");
export const authEnabled = (process.env.DASHBOARD_AUTH_ENABLED ?? "true") !== "false";
export const sessionSecret = process.env.DASHBOARD_SESSION_SECRET ?? process.env.JWT_SECRET ?? "dev-dashboard-secret";
export const cookieName = "redu_os_dashboard_session";

// ── Umami analytics ───────────────────────────────────────────────────────────
export const umamiPublicUrl = process.env.UMAMI_URL ?? "";          // browser-accessible
export const umamiApiUrl = toContainerUrl(process.env.UMAMI_URL, ""); // container-to-container
export const umamiAdminUsername = process.env.UMAMI_ADMIN_USERNAME ?? "admin";
export const umamiAdminPassword = process.env.UMAMI_ADMIN_PASSWORD ?? "";

// ── Langfuse tracing ──────────────────────────────────────────────────────────
export const langfuseApiUrl = toContainerUrl(process.env.LANGFUSE_HOST, "");
export const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY ?? "";
export const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY ?? "";
export const langfuseTracingEnabled =
  process.env.LANGFUSE_ENABLED === "true" &&
  !!toContainerUrl(process.env.LANGFUSE_HOST, "") &&
  !!(process.env.LANGFUSE_PUBLIC_KEY) &&
  !!(process.env.LANGFUSE_SECRET_KEY);

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    // Node 18 has no native WebSocket — provide the ws package
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transport: ws as any
  }
});

export function jsonHeaders(apiKey?: string) {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {})
  };
}
