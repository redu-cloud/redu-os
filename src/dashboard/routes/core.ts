import type { FastifyInstance } from "fastify";
import {
  supabase,
  collectorUrl,
  collectorApiKey,
  qdrantUrl,
  qdrantApiKey,
  qdrantCollection,
  ollamaUrl,
  supabaseUrl,
  activepiecesUrl,
  studioUrl,
  langgraphUrl,
  litellmUrl,
  litellmMasterKey,
  umamiApiUrl,
  langfuseUrl,
  uptimeKumaUrl,
  glitchtipUrl,
  listmonkUrl,
  listmonkAdminUsername,
  listmonkAdminPassword,
  zammadUrl,
  jsonHeaders,
  toPublicUrl
} from "../config.js";

async function httpOk(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, init);
    return response.ok;
  } catch {
    return false;
  }
}

async function qdrantCount() {
  if (!qdrantApiKey) return null;

  try {
    const response = await fetch(`${qdrantUrl}/collections/${qdrantCollection}`, {
      headers: { "api-key": qdrantApiKey }
    });

    if (!response.ok) return null;
    const body = await response.json() as { result?: { points_count?: number } };
    return body.result?.points_count ?? null;
  } catch {
    return null;
  }
}

async function tableCount(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) return null;
  return count ?? 0;
}

async function recentData() {
  const [events, insights, actions, feedback, counts] = await Promise.all([
    supabase.from("startup_events").select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from("ai_insights").select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from("ai_actions").select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from("ai_feedback").select("*").order("created_at", { ascending: false }).limit(12),
    Promise.all([
      tableCount("startup_events"),
      tableCount("ai_insights"),
      tableCount("ai_actions"),
      tableCount("ai_feedback"),
      qdrantCount()
    ])
  ]);

  for (const result of [events, insights, actions, feedback]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    counts: {
      events: counts[0],
      insights: counts[1],
      actions: counts[2],
      feedback: counts[3],
      memory: counts[4]
    },
    events: events.data ?? [],
    insights: insights.data ?? [],
    actions: actions.data ?? [],
    feedback: feedback.data ?? []
  };
}

async function services() {
  // ── Core services (always checked) ────────────────────────────────────────
  const coreChecks = {
    collector:    httpOk(`${collectorUrl}/health`),
    supabase:     httpOk(`${supabaseUrl}/rest/v1/`, {
                    headers: process.env.ANON_KEY ? { apikey: process.env.ANON_KEY } : {}
                  }),
    qdrant:       httpOk(`${qdrantUrl}/collections`, {
                    headers: qdrantApiKey ? { "api-key": qdrantApiKey } : {}
                  }),
    ollama:       httpOk(`${ollamaUrl}/api/tags`),
    activepieces: httpOk(activepiecesUrl),
    litellm:      litellmUrl
                    ? httpOk(`${litellmUrl}/health/liveliness`)
                    : Promise.resolve(false),
    langgraph:    langgraphUrl
                    ? httpOk(`${langgraphUrl}/health`)
                    : Promise.resolve(false),
  };

  // ── Optional modules (only included if URL is configured) ─────────────────
  const optionalChecks: Record<string, Promise<boolean>> = {};
  if (umamiApiUrl)     optionalChecks.umami       = httpOk(`${umamiApiUrl}/api/heartbeat`);
  if (langfuseUrl)     optionalChecks.langfuse     = httpOk(`${langfuseUrl}/api/public/health`);
  if (uptimeKumaUrl)   optionalChecks["uptime-kuma"] = httpOk(uptimeKumaUrl);
  if (glitchtipUrl)    optionalChecks.glitchtip    = httpOk(`${glitchtipUrl}/api/0/`);
  if (listmonkUrl)     optionalChecks.listmonk     = httpOk(`${listmonkUrl}/api/health`, {
                         headers: { Authorization: `Basic ${Buffer.from(`${listmonkAdminUsername}:${listmonkAdminPassword}`).toString("base64")}` }
                       });
  if (zammadUrl)       optionalChecks.zammad       = httpOk(zammadUrl);

  const allKeys   = [...Object.keys(coreChecks), ...Object.keys(optionalChecks)];
  const allChecks = [...Object.values(coreChecks), ...Object.values(optionalChecks)];
  const results   = await Promise.all(allChecks);

  const status: Record<string, boolean> = {};
  allKeys.forEach((key, i) => {
    // Skip core services that have no URL configured
    if (key === "langgraph" && !langgraphUrl) return;
    if (key === "litellm"   && !litellmUrl)   return;
    status[key] = results[i];
  });

  return status;
}


export function register(app: FastifyInstance): void {
  app.get("/api/summary", async () => {
    const [data, serviceStatus] = await Promise.all([
      recentData(),
      services()
    ]);

    return {
      ok: true,
      generated_at: new Date().toISOString(),
      links: {
        collector:       toPublicUrl(collectorUrl),
        supabase_api:    toPublicUrl(supabaseUrl),
        supabase_studio: toPublicUrl(studioUrl),
        qdrant:          toPublicUrl(qdrantUrl),
        ollama:          toPublicUrl(ollamaUrl),
        activepieces:    toPublicUrl(activepiecesUrl),
        ...(litellmUrl    ? { litellm:     toPublicUrl(litellmUrl) }    : {}),
        ...(langgraphUrl  ? { langgraph:   toPublicUrl(langgraphUrl) }  : {}),
        ...(umamiApiUrl   ? { umami:       toPublicUrl(umamiApiUrl) }   : {}),
        ...(langfuseUrl   ? { langfuse:    toPublicUrl(langfuseUrl) }   : {}),
        ...(uptimeKumaUrl ? { uptime_kuma: toPublicUrl(uptimeKumaUrl) } : {}),
        ...(glitchtipUrl  ? { glitchtip:   toPublicUrl(glitchtipUrl) }  : {}),
        ...(listmonkUrl   ? { listmonk:    toPublicUrl(listmonkUrl) }   : {}),
        ...(zammadUrl     ? { zammad:      toPublicUrl(zammadUrl) }     : {}),
      },
      services: serviceStatus,
      ...data
    };
  });

  app.post("/api/demo/:kind", async (request, reply) => {
    const kind = (request.params as { kind: string }).kind;

    if (kind !== "full") {
      reply.status(404);
      return { ok: false, error: `Unknown demo: ${kind}` };
    }

    type DemoEvent = { label: string; path: string; payload: unknown };
    const demoEvents: DemoEvent[] = [
      {
        label: "Support escalation",
        path: "/v1/events",
        payload: {
          type: "support.ticket.created", source: "demo:full", severity: "high",
          user: { email: "founder@example.com", name: "Demo Founder" },
          message: "A paid customer cannot finish onboarding after selecting a keypair and is asking for urgent help.",
          metadata: { plan: "startup", area: "onboarding", blocked_step: "create_instance", demo: true }
        }
      },
      {
        label: "Reliability incident",
        path: "/v1/events",
        payload: {
          type: "uptime.monitor.down", source: "uptime-kuma", severity: "critical",
          message: "Production API health check is down for 3 minutes. Checkout and dashboard requests are failing.",
          metadata: { monitor_name: "production-api", monitor_url: "https://api.example.com/health", demo: true }
        }
      },
      {
        label: "Uptime Kuma alert",
        path: "/v1/events/uptime-kuma",
        payload: {
          monitor: { name: "Production API", url: "https://api.example.com/health" },
          heartbeat: { status: 0, msg: "timeout after 10 seconds", time: new Date().toISOString() }
        }
      },
      {
        label: "GlitchTip error",
        path: "/v1/events/glitchtip",
        payload: {
          project_name: "AI OS Demo", level: "error", culprit: "POST /api/checkout",
          event: {
            title: "Checkout API failed", transaction: "POST /api/checkout",
            release: "v1.0.0", environment: "production",
            request: { method: "POST", url: "https://app.example.com/api/checkout" },
            user: { email: "buyer@example.com", name: "Demo Buyer" },
            exception: { values: [{ type: "PaymentProviderTimeout", value: "Stripe request timed out after 10 seconds" }] }
          }
        }
      },
      {
        label: "Product feedback",
        path: "/v1/events",
        payload: {
          type: "product.feedback.created", source: "demo:full", severity: "medium",
          user: { email: "beta@example.com", name: "Beta User" },
          message: "The deployment page is confusing. I expected the keypair and security group steps to be explained before launch.",
          metadata: { area: "deployments", feedback_channel: "in-app", demo: true }
        }
      },
      {
        label: "Growth signal",
        path: "/v1/events",
        payload: {
          type: "signup.trial.created", source: "umami", severity: "info",
          user: { email: "ops-lead@example.com", name: "Ops Lead" },
          message: "New trial signup from a startup operations lead who visited pricing, docs, and the deployment template page.",
          metadata: { company_size: "12", visited_pages: ["pricing", "docs", "templates"], demo: true }
        }
      },
      {
        label: "Umami analytics",
        path: "/v1/events/umami",
        payload: {
          type: "event",
          payload: {
            website: "demo-website-id", hostname: "redu-os.demo",
            referrer: "https://redu.cloud/pricing", title: "reduOS Dashboard",
            url: "/onboarding/create-instance", name: "onboarding_abandoned",
            data: { email: "founder@example.com", name: "Demo Founder", plan: "startup", step: "create_instance", source: "full-demo" }
          }
        }
      },
      {
        label: "Zammad ticket",
        path: "/v1/events/zammad",
        payload: {
          name: "Milos Demo", email: "milos@example.com",
          title: "Server is down",
          message: "My production server is down after a deploy and I need help quickly.",
          priority: "high"
        }
      },
      {
        label: "Listmonk subscriber",
        path: "/v1/events/listmonk",
        payload: {
          event: "subscriber.created", email: "founder-waitlist@example.com",
          name: "Waitlist Founder", company: "TinyOps AI", source: "pricing-page",
          list_name: "Beta Users", list_uuid: "demo-beta-users",
          attribs: { plan_interest: "startup", team_size: "4" }
        }
      }
    ];

    const lines: string[] = [`reduOS full demo — ${demoEvents.length} events`, ""];
    const results: unknown[] = [];
    let ok = true;

    for (const evt of demoEvents) {
      try {
        const response = await fetch(`${collectorUrl}${evt.path}`, {
          method: "POST",
          headers: jsonHeaders(collectorApiKey),
          body: JSON.stringify(evt.payload)
        });
        const data = await response.json() as Record<string, unknown>;
        results.push(data);
        const insight = data.insight as Record<string, unknown> | undefined;
        lines.push(
          `✓ ${evt.label}\n` +
          `  event_id: ${data.event_id ?? "N/A"}\n` +
          `  insight:  ${insight?.priority ?? "-"} / ${insight?.category ?? "-"}\n` +
          `  summary:  ${String(insight?.summary ?? "").slice(0, 100)}`
        );
      } catch (err) {
        ok = false;
        lines.push(`✗ ${evt.label}: ${err instanceof Error ? err.message : String(err)}`);
        results.push({ ok: false, error: String(err) });
      }
    }

    lines.push("", "Full demo complete.");
    return { ok, count: demoEvents.length, stdout: lines.join("\n"), stderr: "", results };
  });

  app.post("/api/event/:kind", async (request, reply) => {
    const kind = (request.params as { kind: string }).kind;
    const payloads: Record<string, unknown> = {
      support: {
        type: "support.ticket.created",
        source: "dashboard",
        severity: "high",
        user: { email: "founder@example.com", name: "Demo Founder" },
        message: "A paid customer cannot finish onboarding after selecting a keypair and is asking for urgent help.",
        metadata: { area: "onboarding", dashboard: true }
      },
      reliability: {
        type: "uptime.monitor.down",
        source: "uptime-kuma",
        severity: "critical",
        message: "Production API health check is down and checkout requests are failing.",
        metadata: { monitor_name: "production-api", dashboard: true }
      },
      product: {
        type: "product.feedback.created",
        source: "dashboard",
        severity: "medium",
        user: { email: "beta@example.com", name: "Beta User" },
        message: "The deployment page is confusing around keypairs and security groups.",
        metadata: { area: "deployments", dashboard: true }
      },
      growth: {
        type: "signup.trial.created",
        source: "umami",
        severity: "info",
        user: { email: "ops-lead@example.com", name: "Ops Lead" },
        message: "New trial signup visited pricing, docs, and deployment templates.",
        metadata: { visited_pages: ["pricing", "docs", "templates"], dashboard: true }
      },
      uptime: {
        monitor: {
          name: "Production API",
          url: "https://api.example.com/health"
        },
        heartbeat: {
          status: 0,
          msg: "timeout after 10 seconds",
          time: new Date().toISOString()
        }
      },
      umami: {
        type: "event",
        payload: {
          website: "dashboard-demo-website",
          hostname: "redu-os.demo",
          referrer: "https://redu.cloud/pricing",
          title: "reduOS Dashboard",
          url: "/onboarding/create-instance",
          name: "onboarding_abandoned",
          data: {
            email: "founder@example.com",
            name: "Demo Founder",
            plan: "startup",
            step: "create_instance",
            source: "dashboard"
          }
        }
      },
      listmonk: {
        event: "subscriber.created",
        email: "founder-waitlist@example.com",
        name: "Waitlist Founder",
        company: "TinyOps AI",
        source: "pricing-page",
        list_name: "Beta Users",
        list_uuid: "demo-beta-users",
        attribs: {
          plan_interest: "startup",
          team_size: "4"
        }
      },
      glitchtip: {
        project_name: "AI OS Demo",
        level: "error",
        culprit: "POST /api/checkout",
        event_id: "dashboard-glitchtip-001",
        event: {
          title: "Checkout API failed",
          transaction: "POST /api/checkout",
          release: "v1.0.0",
          environment: "production",
          request: {
            method: "POST",
            url: "https://app.example.com/api/checkout"
          },
          user: {
            email: "buyer@example.com",
            name: "Demo Buyer"
          },
          exception: {
            values: [
              {
                type: "PaymentProviderTimeout",
                value: "Stripe request timed out after 10 seconds"
              }
            ]
          }
        }
      },
      zammad: {
        name: "Milos Demo",
        email: "milos@example.com",
        title: "Server is down",
        message: "My production server is down after a deploy and I need help quickly.",
        priority: "high"
      }
    };

    const payload = payloads[kind];
    if (!payload) {
      reply.status(404);
      return { ok: false, error: `Unknown event: ${kind}` };
    }

    const paths: Record<string, string> = {
      glitchtip: "/v1/events/glitchtip",
      listmonk: "/v1/events/listmonk",
      umami: "/v1/events/umami",
      uptime: "/v1/events/uptime-kuma",
      zammad: "/v1/events/zammad"
    };
    const path = paths[kind] ?? "/v1/events";
    const response = await fetch(`${collectorUrl}${path}`, {
      method: "POST",
      headers: jsonHeaders(collectorApiKey),
      body: JSON.stringify(payload)
    });

    const body = await response.json();
    reply.status(response.status);
    return body;
  });
}
