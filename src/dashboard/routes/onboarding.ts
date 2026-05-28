import type { FastifyInstance } from "fastify";
import {
  supabase,
  collectorUrl,
  collectorApiKey,
  jsonHeaders,
  toPublicUrl,
  uptimeKumaUrl,
  glitchtipUrl,
  glitchtipPublicDsn,
  listmonkUrl,
  zammadUrl,
  umamiApiUrl,
  umamiPublicUrl,
  umamiAdminUsername,
  umamiAdminPassword,
} from "../config.js";
import { umamiWebsiteId } from "../umami.js";

// Services that have dedicated event-source endpoints on the collector.
// Only included in the response when the service URL is configured in .env.
const SOURCE_SERVICES = [
  { id: "umami",       source: "umami",       name: "Umami",       urlVar: () => umamiApiUrl    },
  { id: "glitchtip",   source: "glitchtip",   name: "GlitchTip",   urlVar: () => glitchtipUrl   },
  { id: "uptime_kuma", source: "uptime-kuma", name: "Uptime Kuma", urlVar: () => uptimeKumaUrl  },
  { id: "zammad",      source: "zammad",      name: "Zammad",      urlVar: () => zammadUrl      },
  { id: "listmonk",    source: "listmonk",    name: "Listmonk",    urlVar: () => listmonkUrl    },
] as const;

/**
 * Poll Umami API for pageview count.
 * Returns the number of pageviews in the last 30 days, or null on error.
 */
async function umamiPageviewCount(): Promise<number | null> {
  if (!umamiApiUrl || !umamiAdminPassword || !umamiWebsiteId) return null;
  try {
    const loginRes = await fetch(`${umamiApiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: umamiAdminUsername, password: umamiAdminPassword }),
      signal: AbortSignal.timeout(4_000)
    });
    if (!loginRes.ok) return null;
    const { token } = await loginRes.json() as { token: string };

    const now   = Date.now();
    const start = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    const statsRes = await fetch(
      `${umamiApiUrl}/api/websites/${umamiWebsiteId}/stats?startAt=${start}&endAt=${now}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4_000) }
    );
    if (!statsRes.ok) return null;
    const stats = await statsRes.json() as { pageviews?: { value: number } };
    return stats.pageviews?.value ?? 0;
  } catch {
    return null;
  }
}

/**
 * Send a synthetic "first pageview" event to the collector
 * when Umami has visitors but no umami events have been recorded yet.
 * Fire-and-forget — failure is silent.
 */
async function bridgeFirstUmamiVisitor(): Promise<void> {
  try {
    await fetch(`${collectorUrl}/v1/events/umami`, {
      method: "POST",
      headers: jsonHeaders(collectorApiKey),
      body: JSON.stringify({
        type:     "pageview",
        url:      "/",
        hostname: "your-website.com",
        referrer: "",
        title:    "First Visitor"
      }),
      signal: AbortSignal.timeout(5_000)
    });
  } catch { /* best-effort */ }
}

export function register(app: FastifyInstance): void {
  /**
   * GET /api/onboarding
   * Returns:
   *   steps   — core setup steps with done status
   *   services — per-source event steps (only for configured services)
   *   snippet  — data needed to render setup snippets client-side
   */
  app.get("/api/onboarding", async () => {
    // ── Collector config: AI provider + notification channels ─────────────────
    let aiConfigured = false;
    let notificationsConfigured = false;
    try {
      const r = await fetch(`${collectorUrl}/internal/config`, {
        headers: jsonHeaders(collectorApiKey),
        signal: AbortSignal.timeout(4_000)
      });
      if (r.ok) {
        const d = await r.json() as {
          ai_provider?: string;
          notifications?: {
            discord?:  { configured: boolean };
            slack?:    { configured: boolean };
            telegram?: { configured: boolean };
          };
        };
        aiConfigured = (d.ai_provider ?? "fallback") !== "fallback";
        const n = d.notifications ?? {};
        notificationsConfigured = !!(
          n.discord?.configured || n.slack?.configured || n.telegram?.configured
        );
      }
    } catch { /* collector starting */ }

    // ── Which services are enabled (URL configured in env) ────────────────────
    const enabledServices = SOURCE_SERVICES.filter(s => !!s.urlVar());

    // ── Parallel queries: total event count, total insight count, per-source counts
    const [evResult, insResult, ...srcResults] = await Promise.all([
      supabase.from("startup_events").select("id", { count: "exact", head: true }),
      supabase.from("ai_insights").select("id",    { count: "exact", head: true }),
      ...enabledServices.map(s =>
        supabase.from("startup_events")
          .select("id", { count: "exact", head: true })
          .eq("source", s.source)
      )
    ]);

    // ── Umami auto-bridge: if Umami has visitors but no events yet, create one ─
    const umamiService = enabledServices.find(s => s.id === "umami");
    if (umamiService) {
      const umamiIdx  = enabledServices.indexOf(umamiService);
      const umamiDone = (srcResults[umamiIdx]?.count ?? 0) > 0;
      if (!umamiDone) {
        const views = await umamiPageviewCount();
        if (views !== null && views > 0) {
          await bridgeFirstUmamiVisitor();
          // Re-query after bridging so the response reflects the new event
          const recheck = await supabase.from("startup_events")
            .select("id", { count: "exact", head: true })
            .eq("source", "umami");
          srcResults[umamiIdx] = recheck;
        }
      }
    }

    const services = enabledServices.map((s, i) => ({
      id:     s.id,
      name:   s.name,
      source: s.source,
      // done is always false — user must explicitly skip/confirm each service
      done:   false,
      events: srcResults[i]?.count ?? 0,
    }));

    return {
      ok: true,
      steps: {
        ai:            aiConfigured,
        notifications: notificationsConfigured,
        first_event:   (evResult.count  ?? 0) > 0,
        first_insight: (insResult.count ?? 0) > 0,
      },
      services,
      // Snippet data for client-side rendering
      collector_url:     toPublicUrl(collectorUrl),
      collector_api_key: collectorApiKey,          // shown to authenticated users for webhook config
      umami_url:         umamiPublicUrl || null,
      umami_website_id:  umamiWebsiteId  || null,
      glitchtip_dsn:     glitchtipPublicDsn || null,
    };
  });
}
