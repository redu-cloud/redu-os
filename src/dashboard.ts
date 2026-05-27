import { execFile } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { promisify } from "node:util";
import Fastify from "fastify";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".local/supabase-local.env" });

const execFileAsync = promisify(execFile);

const port = Number(process.env.DASHBOARD_PORT ?? 3006);
// Running in a container: translate any 127.0.0.1 host URLs to host.containers.internal
function toContainerUrl(url: string | undefined, fallback: string): string {
  return (url ?? fallback).replace("127.0.0.1", "host.containers.internal");
}

const collectorUrl = toContainerUrl(process.env.COLLECTOR_URL, "http://host.containers.internal:3005");
const collectorApiKey = process.env.COLLECTOR_API_KEY ?? "change-me-please";
const qdrantUrl = toContainerUrl(process.env.QDRANT_URL, "http://host.containers.internal:6333");
const qdrantApiKey = process.env.QDRANT_API_KEY ?? "";
const qdrantCollection = process.env.QDRANT_COLLECTION ?? "redu_os_events";
const ollamaUrl = toContainerUrl(process.env.OLLAMA_URL, "http://host.containers.internal:11435");
const supabaseUrl = toContainerUrl(process.env.SUPABASE_URL, "http://host.containers.internal:8000");
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseAnonKey = process.env.ANON_KEY ?? "";
const activepiecesUrl = toContainerUrl(process.env.AP_FRONTEND_URL, "http://host.containers.internal:8080");
const studioUrl = toContainerUrl(process.env.SUPABASE_STUDIO_URL, "http://host.containers.internal:3000");
const langgraphUrl = toContainerUrl(process.env.LANGGRAPH_URL, "");
const langgraphApiKey = process.env.LANGGRAPH_API_KEY ?? "";
const authEnabled = (process.env.DASHBOARD_AUTH_ENABLED ?? "true") !== "false";
const sessionSecret = process.env.DASHBOARD_SESSION_SECRET ?? process.env.JWT_SECRET ?? "dev-dashboard-secret";
const cookieName = "redu_os_dashboard_session";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
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

const podmanSocket = process.env.PODMAN_SOCKET_PATH ?? "/run/podman/podman.sock";

/** Raw GET against the Podman REST API via Unix socket. Returns a Buffer. */
function podmanRequest(apiPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: podmanSocket, path: apiPath, method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Parse Docker/Podman multiplexed log stream.
 * Format per frame: [streamType(1)][pad(3)][length(4 BE)] + payload
 */
function parseLogStream(buf: Buffer): Array<{ stream: "stdout" | "stderr"; text: string }> {
  const lines: Array<{ stream: "stdout" | "stderr"; text: string }> = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const streamType = buf[offset];
    const payloadLen = buf.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + payloadLen > buf.length) break;
    const text = buf.subarray(offset, offset + payloadLen).toString("utf8").replace(/\n$/, "");
    if (text.length > 0) {
      lines.push({ stream: streamType === 2 ? "stderr" : "stdout", text });
    }
    offset += payloadLen;
  }
  return lines;
}

const app = Fastify({ logger: true });

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function signedCookie(value: string) {
  const encoded = base64Url(value);
  return `${encoded}.${sign(encoded)}`;
}

function verifySignedCookie(value: string | undefined) {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    return fromBase64Url(encoded);
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined) {
  const cookies: Record<string, string> = {};
  for (const part of (cookieHeader ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

async function currentUser(cookieHeader: string | undefined) {
  if (!authEnabled) return { email: "auth-disabled" };

  const token = verifySignedCookie(parseCookies(cookieHeader)[cookieName]);
  if (!token || !supabaseAnonKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) return null;
    return await response.json() as { email?: string };
  } catch {
    return null;
  }
}

function setSessionCookie(reply: { header: (name: string, value: string) => unknown }, accessToken: string) {
  const secure = process.env.DASHBOARD_COOKIE_SECURE === "true" ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(signedCookie(accessToken))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`
  );
}

function clearSessionCookie(reply: { header: (name: string, value: string) => unknown }) {
  reply.header("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

app.addHook("preHandler", async (request, reply) => {
  const path = request.url.split("?")[0];
  const publicPaths = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);
  if (publicPaths.has(path)) return;

  const user = await currentUser(request.headers.cookie);
  if (user) {
    return;
  }

  if (path.startsWith("/api/")) {
    return reply.status(401).send({ ok: false, error: "authentication_required" });
  }

  return reply.redirect("/login");
});

function jsonHeaders(apiKey?: string) {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {})
  };
}

app.get("/login", async (_request, reply) => {
  if (!authEnabled) {
    reply.redirect("/");
    return;
  }

  reply.type("text/html");
  return loginHtml;
});

app.post("/api/auth/login", async (request, reply) => {
  const body = request.body as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password ?? "";

  if (!email || !password) {
    reply.status(400);
    return { ok: false, error: "Email and password are required." };
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey
    },
    body: JSON.stringify({ email, password })
  });

  const result = await response.json() as { access_token?: string; error_description?: string; msg?: string };
  if (!response.ok || !result.access_token) {
    reply.status(401);
    return {
      ok: false,
      error: result.error_description || result.msg || "Invalid email or password."
    };
  }

  setSessionCookie(reply, result.access_token);
  return { ok: true };
});

app.post("/api/auth/logout", async (_request, reply) => {
  clearSessionCookie(reply);
  return { ok: true };
});

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
  const checks: Promise<boolean>[] = [
    httpOk(`${collectorUrl}/health`),
    httpOk(`${supabaseUrl}/rest/v1/`, {
      headers: process.env.ANON_KEY ? { apikey: process.env.ANON_KEY } : {}
    }),
    httpOk(`${qdrantUrl}/collections`, {
      headers: qdrantApiKey ? { "api-key": qdrantApiKey } : {}
    }),
    httpOk(`${ollamaUrl}/api/tags`),
    httpOk(activepiecesUrl)
  ];

  if (langgraphUrl) {
    checks.push(httpOk(`${langgraphUrl}/health`));
  }

  const results = await Promise.all(checks);
  const [collector, supabaseRest, qdrant, ollama, activepieces, langraph] = results;

  const status: Record<string, boolean> = {
    collector,
    supabase: supabaseRest,
    qdrant,
    ollama,
    activepieces
  };

  if (langgraphUrl) {
    status.langgraph = langraph;
  }

  return status;
}

async function runScript(script: string) {
  const { stdout, stderr } = await execFileAsync("bash", [script], {
    cwd: process.cwd(),
    timeout: 180_000,
    env: {
      ...process.env,
      COLLECTOR_URL: collectorUrl,
      COLLECTOR_API_KEY: collectorApiKey
    },
    maxBuffer: 1024 * 1024 * 3
  });

  return { stdout, stderr };
}

app.get("/api/summary", async () => {
  const [data, serviceStatus] = await Promise.all([
    recentData(),
    services()
  ]);

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    links: {
      collector: collectorUrl,
      supabase_api: supabaseUrl,
      supabase_studio: studioUrl,
      qdrant: qdrantUrl,
      ollama: ollamaUrl,
      activepieces: activepiecesUrl,
      ...(langgraphUrl ? { langgraph: langgraphUrl } : {})
    },
    services: serviceStatus,
    ...data
  };
});

app.post("/api/demo/:kind", async (request, reply) => {
  const kind = (request.params as { kind: string }).kind;
  const scripts: Record<string, string> = {
    full: "scripts/demo-full-loop.sh",
    onboarding: "scripts/demo-onboarding-loop.sh"
  };

  const script = scripts[kind];
  if (!script) {
    reply.status(404);
    return { ok: false, error: `Unknown demo: ${kind}` };
  }

  const result = await runScript(script);
  return { ok: true, ...result };
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

  reply.status(response.status);
  return response.json();
});

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
    reply.status(response.status);
    return responseBody;
  } catch (error) {
    reply.status(503);
    return { ok: false, error: error instanceof Error ? error.message : "LangGraph connection failed" };
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   Extended data API routes (dashboard pages)
───────────────────────────────────────────────────────────────────────────── */

app.get("/api/events", async (request) => {
  const q = request.query as Record<string, string>;
  const limit = Math.min(Number(q.limit ?? 50), 200);
  const offset = Number(q.offset ?? 0);

  let query = supabase
    .from("startup_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q.source) query = query.eq("source", q.source);
  if (q.severity) query = query.eq("severity", q.severity);
  if (q.type) query = query.ilike("type", `%${q.type}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { ok: true, items: data ?? [], total: count ?? 0 };
});

app.get("/api/events/:id", async (request, reply) => {
  const id = (request.params as { id: string }).id;

  const [evtRes, insRes, actRes, fbRes] = await Promise.all([
    supabase.from("startup_events").select("*").eq("id", id).single(),
    supabase.from("ai_insights").select("*").eq("startup_event_id", id).order("created_at", { ascending: false }),
    supabase.from("ai_actions").select("*").eq("startup_event_id", id).order("created_at", { ascending: false }),
    supabase.from("ai_feedback").select("*").eq("startup_event_id", id).order("created_at", { ascending: false })
  ]);

  if (evtRes.error) { reply.status(404); return { ok: false, error: "Event not found" }; }
  return { ok: true, event: evtRes.data, insights: insRes.data ?? [], actions: actRes.data ?? [], feedback: fbRes.data ?? [] };
});

app.get("/api/insights", async (request) => {
  const q = request.query as Record<string, string>;
  const limit = Math.min(Number(q.limit ?? 50), 200);
  const offset = Number(q.offset ?? 0);

  let query = supabase
    .from("ai_insights")
    .select("*, startup_events(id,type,source,severity,message,created_at)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q.priority) query = query.eq("priority", q.priority);
  if (q.category) query = query.ilike("category", `%${q.category}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { ok: true, items: data ?? [], total: count ?? 0 };
});

app.get("/api/actions", async (request) => {
  const q = request.query as Record<string, string>;
  const limit = Math.min(Number(q.limit ?? 50), 200);
  const offset = Number(q.offset ?? 0);

  let query = supabase
    .from("ai_actions")
    .select("*, startup_events(id,type,source,message)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q.status) query = query.eq("status", q.status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { ok: true, items: data ?? [], total: count ?? 0 };
});

app.patch("/api/actions/:id", async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const body = request.body as { status?: string };
  const allowed = ["approved", "rejected", "completed", "failed"];

  if (!body.status || !allowed.includes(body.status)) {
    reply.status(400);
    return { ok: false, error: `status must be one of: ${allowed.join(", ")}` };
  }

  const { data, error } = await supabase
    .from("ai_actions")
    .update({ status: body.status, completed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) { reply.status(500); return { ok: false, error: error.message }; }
  return { ok: true, action: data };
});

app.get("/api/feedback", async (request) => {
  const q = request.query as Record<string, string>;
  const limit = Math.min(Number(q.limit ?? 50), 200);
  const offset = Number(q.offset ?? 0);

  const { data, error, count } = await supabase
    .from("ai_feedback")
    .select("*, startup_events(id,type,source,message), ai_actions(id,action_type,status)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return { ok: true, items: data ?? [], total: count ?? 0 };
});

app.post("/api/feedback/submit", async (request, reply) => {
  const body = request.body as {
    startup_event_id: string;
    ai_action_id?: string;
    feedback_type: string;
    score?: number;
    result?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.startup_event_id || !body.feedback_type) {
    reply.status(400);
    return { ok: false, error: "startup_event_id and feedback_type are required" };
  }

  const { data, error } = await supabase
    .from("ai_feedback")
    .insert({
      startup_event_id: body.startup_event_id,
      ai_action_id: body.ai_action_id ?? null,
      feedback_type: body.feedback_type,
      score: body.score ?? null,
      result: body.result ?? null,
      metadata: body.metadata ?? {}
    })
    .select()
    .single();

  if (error) { reply.status(500); return { ok: false, error: error.message }; }
  return { ok: true, feedback: data };
});

app.get("/api/ai-config", async () => {
  const provider = process.env.AI_PROVIDER ?? "fallback";
  const aiEnabled = process.env.AI_ENABLED === "true";
  const qdrantEnabled = process.env.QDRANT_ENABLED === "true";
  const langfuseEnabled = process.env.LANGFUSE_ENABLED === "true";

  return {
    ok: true,
    ai_enabled: aiEnabled,
    ai_provider: provider,
    qdrant_enabled: qdrantEnabled,
    langfuse_enabled: langfuseEnabled,
    langfuse_host: process.env.LANGFUSE_HOST ?? null,
    langfuse_public_key: process.env.LANGFUSE_PUBLIC_KEY ? "••••••" : null,
    ollama: {
      url: ollamaUrl,
      chat_model: process.env.OLLAMA_MODEL ?? "deepseek-r1:1.5b",
      embed_model: process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text"
    },
    litellm: {
      base_url: process.env.AI_CHAT_BASE_URL || null,
      model: process.env.AI_CHAT_MODEL || null,
      api_key_set: !!(process.env.AI_CHAT_API_KEY)
    }
  };
});

app.get("/api/settings", async () => {
  return {
    ok: true,
    instance: {
      name: process.env.INSTANCE_NAME ?? "reduOS",
      version: "0.1.0",
      dashboard_auth_enabled: authEnabled
    },
    features: {
      ai_enabled: process.env.AI_ENABLED === "true",
      qdrant_enabled: process.env.QDRANT_ENABLED === "true",
      langfuse_enabled: process.env.LANGFUSE_ENABLED === "true",
      automation_enabled: !!(process.env.AUTOMATION_WEBHOOK_URL || process.env.AUTOMATION_WEBHOOK_URLS),
      litellm_enabled: process.env.AI_PROVIDER === "litellm" && !!(process.env.AI_CHAT_BASE_URL),
      langgraph_enabled: !!(langgraphUrl)
    },
    urls: {
      collector: collectorUrl,
      supabase_api: supabaseUrl,
      supabase_studio: studioUrl,
      qdrant: qdrantUrl,
      ollama: ollamaUrl,
      activepieces: activepiecesUrl,
      ...(langgraphUrl ? { langgraph: langgraphUrl } : {})
    },
    api_key_hint: collectorApiKey && collectorApiKey !== "change-me-please"
      ? `${collectorApiKey.slice(0, 4)}${"•".repeat(Math.max(0, collectorApiKey.length - 8))}${collectorApiKey.slice(-4)}`
      : "not configured"
  };
});

/* ── Container logs (Podman socket) ───────────────────────────── */

app.get("/api/containers", async (_request, reply) => {
  try {
    const buf = await podmanRequest("/v4.0.0/libpod/containers/json?all=true");
    const raw = JSON.parse(buf.toString()) as Array<{
      Names: string[];
      State: string;
      Image: string;
      Ports?: Array<{ hostPort: number; containerPort: number; protocol: string }> | null;
      StartedAt: number;
    }>;
    return {
      ok: true,
      items: raw.map((c) => ({
        name: (c.Names[0] ?? "").replace(/^\//, ""),
        state: c.State,
        image: c.Image.split("/").pop() ?? c.Image,
        ports: (c.Ports ?? [])
          .filter((p) => p.hostPort)
          .map((p) => `${p.hostPort}:${p.containerPort}`)
          .join(", "),
        started: c.StartedAt
      }))
    };
  } catch (err) {
    reply.status(503);
    return { ok: false, error: "Podman socket unavailable", items: [] };
  }
});

app.get("/api/containers/:name/logs", async (request, reply) => {
  const { name } = request.params as { name: string };
  const { tail = "200" } = request.query as { tail?: string };
  const tailN = Math.min(Math.max(1, Number(tail) || 200), 2000);
  try {
    const buf = await podmanRequest(
      `/v4.0.0/libpod/containers/${encodeURIComponent(name)}/logs?stdout=true&stderr=true&tail=${tailN}&timestamps=false`
    );
    return { ok: true, lines: parseLogStream(buf) };
  } catch (err) {
    reply.status(503);
    return { ok: false, error: "Podman socket unavailable or container not found", lines: [] };
  }
});

app.get("/", async (_request, reply) => {
  reply.type("text/html");
  return dashboardHtml;
});

/* ─────────────────────────────────────────────────────────────────────────────
   Shared snippets
───────────────────────────────────────────────────────────────────────────── */

const GITHUB_URL = "https://github.com/redu-cloud/redu-os";
const DEPLOY_URL = "https://redu.cloud";

const GH_ICON = String.raw`<svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

const TOPNAV = `
  <nav class="topnav">
    <a href="/" class="brand">
      <div class="brand-mark">r</div>
      <span class="brand-name">reduOS</span>
      <span class="oss-badge">open source</span>
    </a>
    <div class="nav-ctas">
      <a href="${GITHUB_URL}" class="gh-btn" target="_blank" rel="noreferrer">
        ${GH_ICON}
        Star on GitHub
      </a>
      <a href="${DEPLOY_URL}" class="deploy-btn" target="_blank" rel="noreferrer">
        Deploy on redu.cloud
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h7M6.5 3l3 3-3 3"/></svg>
      </a>
    </div>
  </nav>`;

const TOPNAV_CSS = `
    /* ── Top nav ── */
    .topnav {
      height: 54px;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 9px;
      text-decoration: none;
      flex-shrink: 0;
    }
    .brand-mark {
      width: 28px;
      height: 28px;
      background: #6366f1;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 800;
      color: #fff;
      flex-shrink: 0;
      font-family: ui-monospace, monospace;
    }
    .brand-name {
      font-size: 15px;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: -0.3px;
    }
    .oss-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      border: 1px solid #334155;
      border-radius: 4px;
      padding: 2px 6px;
    }
    .nav-ctas {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .gh-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      background: #21262d;
      color: #e6edf3;
      border: 1px solid #30363d;
      border-radius: 6px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .gh-btn:hover { background: #30363d; border-color: #484f58; }
    .deploy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 14px;
      background: #6366f1;
      color: #fff;
      border: 1px solid #6366f1;
      border-radius: 6px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .deploy-btn:hover { background: #4f46e5; border-color: #4f46e5; }`;

/* ─────────────────────────────────────────────────────────────────────────────
   Login page
───────────────────────────────────────────────────────────────────────────── */

const loginHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>reduOS – Sign In</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #f1f5f9;
      --panel: #fff;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --indigo: #6366f1;
      --indigo-dark: #4f46e5;
      --red: #dc2626;
    }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }

    ${TOPNAV_CSS}

    /* ── Page layout ── */
    .page {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 32px;
    }

    /* ── Hero ── */
    .hero {
      text-align: center;
      max-width: 480px;
    }
    .hero h1 {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.6px;
      color: var(--ink);
      margin-bottom: 10px;
    }
    .hero p {
      font-size: 15px;
      color: var(--muted);
      line-height: 1.65;
      margin-bottom: 22px;
    }
    .hero-flow {
      font-size: 13px;
      font-weight: 600;
      color: var(--indigo);
      letter-spacing: 0.1px;
      margin-bottom: 18px;
      font-family: ui-monospace, monospace;
    }
    .hero-pills {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 22px;
      font-size: 12px;
      color: var(--muted);
    }
    .hero-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 10px;
      background: var(--panel);
    }
    .hero-ctas {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cta-gh {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 38px;
      padding: 0 16px;
      background: var(--ink);
      color: #fff;
      border: 1px solid var(--ink);
      border-radius: 7px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .cta-gh:hover { opacity: 0.82; }
    .cta-deploy {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 38px;
      padding: 0 18px;
      background: var(--indigo);
      color: #fff;
      border: 1px solid var(--indigo);
      border-radius: 7px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
    }
    .cta-deploy:hover { background: var(--indigo-dark); border-color: var(--indigo-dark); }

    /* ── Login card ── */
    .login-card {
      width: min(380px, 100%);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.04);
      overflow: hidden;
    }
    .card-header {
      padding: 22px 24px 0;
    }
    .card-header h2 {
      font-size: 17px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 4px;
    }
    .card-header p {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 20px;
    }
    .card-body { padding: 0 24px 24px; }
    .field { margin-bottom: 14px; }
    label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--muted);
      margin-bottom: 5px;
    }
    input[type="email"],
    input[type="password"] {
      width: 100%;
      height: 40px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      padding: 0 12px;
      font: inherit;
      font-size: 14px;
      color: var(--ink);
      background: #fff;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus {
      border-color: var(--indigo);
      box-shadow: 0 0 0 3px rgba(99,102,241,.12);
    }
    .submit-btn {
      width: 100%;
      height: 40px;
      margin-top: 6px;
      background: var(--ink);
      color: #fff;
      border: none;
      border-radius: 7px;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .submit-btn:disabled { opacity: 0.55; cursor: wait; }
    .submit-btn:hover:not(:disabled) { opacity: 0.84; }
    .error-msg {
      min-height: 18px;
      margin-top: 10px;
      color: var(--red);
      font-size: 13px;
    }

    /* ── Footer ── */
    footer {
      text-align: center;
      padding: 18px 24px;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid var(--line);
    }
    footer a { color: #94a3b8; text-decoration: underline; text-underline-offset: 2px; }
    footer a:hover { color: var(--muted); }

    @media (max-width: 480px) {
      .hero h1 { font-size: 24px; }
      .oss-badge { display: none; }
    }
  </style>
</head>
<body>
  ${TOPNAV}

  <div class="page">
    <div class="hero">
      <h1>The AI operative system.</h1>
      <p>Connect events, memory, AI reasoning, automation, and feedback<br>
         into one self-hosted operational loop.</p>

      <div class="hero-flow">
        Events &rarr; Memory &rarr; AI &rarr; Automation &rarr; Feedback
      </div>

      <div class="hero-pills">
        <span class="hero-pill">Self-hosted</span>
        <span class="hero-pill">Apache License 2.0</span>
        <span class="hero-pill">Modular stack</span>
      </div>

      <div class="hero-ctas">
        <a href="${GITHUB_URL}" class="cta-gh" target="_blank" rel="noreferrer">
          ${GH_ICON}
          Star on GitHub
        </a>
        <a href="${DEPLOY_URL}" class="cta-deploy" target="_blank" rel="noreferrer">
          Deploy on redu.cloud
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h7M6.5 3l3 3-3 3"/></svg>
        </a>
      </div>
    </div>

    <div class="login-card">
      <div class="card-header">
        <h2>Sign in to your instance</h2>
        <p>Use the credentials configured during setup.</p>
      </div>
      <div class="card-body">
        <form id="login-form">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="username" required autofocus />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="submit-btn" id="submit" type="submit">Sign In</button>
          <div class="error-msg" id="error-msg"></div>
        </form>
      </div>
    </div>
  </div>

  <footer>
    Open source &middot; Apache 2.0 &middot;
    <a href="${GITHUB_URL}" target="_blank" rel="noreferrer">GitHub</a> &middot;
    <a href="${DEPLOY_URL}" target="_blank" rel="noreferrer">redu.cloud</a>
  </footer>

  <script>
    const form = document.getElementById("login-form");
    const btn  = document.getElementById("submit");
    const err  = document.getElementById("error-msg");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      btn.disabled = true;
      err.textContent = "";
      try {
        const res  = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:    document.getElementById("email").value,
            password: document.getElementById("password").value
          })
        });
        const body = await res.json();
        if (!res.ok || body.ok === false) throw new Error(body.error || "Login failed.");
        window.location.href = "/";
      } catch (ex) {
        err.textContent = ex.message;
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;

/* ─────────────────────────────────────────────────────────────────────────────
   Dashboard SPA
───────────────────────────────────────────────────────────────────────────── */

const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>reduOS</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#f1f5f9;--panel:#fff;--ink:#0f172a;--ink-2:#1e293b;
      --muted:#64748b;--muted-2:#94a3b8;--line:#e2e8f0;
      --indigo:#6366f1;--indigo-dark:#4f46e5;--indigo-light:#eef2ff;
      --green:#16a34a;--green-bg:#dcfce7;--green-text:#166534;
      --red:#dc2626;--red-bg:#fee2e2;--red-text:#991b1b;
      --amber:#d97706;--amber-bg:#fef3c7;--amber-text:#92400e;
      --blue-bg:#dbeafe;--blue-text:#1e40af;
      --violet-bg:#ede9fe;--violet-text:#5b21b6;
      --shadow-xs:0 1px 2px rgba(15,23,42,.05);
      --shadow-sm:0 1px 3px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.05);
      --nav-w:220px;--topnav-h:54px;
    }
    html,body{height:100%}
    body{background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.5}

    ${TOPNAV_CSS}

    /* APP SHELL */
    .app-shell{display:flex;height:calc(100vh - var(--topnav-h))}

    /* SIDEBAR */
    .sidebar{width:var(--nav-w);flex-shrink:0;background:#0f172a;border-right:1px solid #1e293b;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;position:sticky;top:var(--topnav-h);height:calc(100vh - var(--topnav-h))}
    .sidebar-section{padding:16px 10px 6px}
    .sidebar-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#475569;padding:0 6px 6px;display:block}
    .nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;margin-bottom:1px;color:#94a3b8;font-size:13px;font-weight:500;text-decoration:none;cursor:pointer;transition:background .1s,color .1s;border:none;background:transparent;width:100%;text-align:left}
    .nav-item:hover{background:#1e293b;color:#e2e8f0}
    .nav-item.active{background:#1e3a5f;color:#fff;font-weight:600}
    .nav-item.active .nav-icon{color:var(--indigo)}
    .nav-icon{width:15px;height:15px;flex-shrink:0;color:#475569}
    .sidebar-footer{margin-top:auto;padding:12px 10px;border-top:1px solid #1e293b}
    .sign-out-btn{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;color:#64748b;font-size:13px;font-weight:500;cursor:pointer;border:none;background:transparent;width:100%;transition:background .1s,color .1s}
    .sign-out-btn:hover{background:#1e293b;color:#e2e8f0}

    /* MAIN */
    .main-content{flex:1;overflow-y:auto;overflow-x:hidden;min-height:0}
    .page-wrap{padding:24px 28px 48px;max-width:1280px}
    .page-head{margin-bottom:20px}
    .page-title{font-size:20px;font-weight:700;letter-spacing:-.3px;color:var(--ink)}
    .page-sub{font-size:13px;color:var(--muted);margin-top:3px;line-height:1.5}

    /* BUTTONS */
    .btn{display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 13px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--ink-2);font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .12s,border-color .12s}
    .btn:hover{background:var(--bg);border-color:#cbd5e1}
    .btn:disabled{opacity:.5;cursor:wait}
    .btn-sm{height:28px;padding:0 10px;font-size:12px}
    .btn-primary{background:var(--ink);border-color:var(--ink);color:#fff}
    .btn-primary:hover{opacity:.84;background:var(--ink)}
    .btn-indigo{background:var(--indigo);border-color:var(--indigo);color:#fff}
    .btn-indigo:hover{background:var(--indigo-dark);border-color:var(--indigo-dark)}
    .btn-ghost{background:transparent;border-color:transparent;color:var(--muted)}
    .btn-ghost:hover{background:var(--bg);border-color:var(--line);color:var(--ink)}
    .btn-danger{background:#fff;border-color:#fca5a5;color:var(--red)}
    .btn-danger:hover{background:var(--red-bg)}
    .btn-success{background:#fff;border-color:#86efac;color:var(--green)}
    .btn-success:hover{background:var(--green-bg)}

    /* CARDS */
    .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow-xs);overflow:hidden}
    .card+.card{margin-top:14px}
    .card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;border-bottom:1px solid var(--line);background:#fafbfd}
    .card-title{font-size:12px;font-weight:700;color:var(--ink-2);text-transform:uppercase;letter-spacing:.4px}
    .card-actions{display:flex;align-items:center;gap:6px}
    .card-body{padding:16px}
    .card-desc{font-size:13px;color:var(--muted);line-height:1.6}

    /* METRICS */
    .metrics-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:20px}
    .metric-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;box-shadow:var(--shadow-xs)}
    .metric-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:7px}
    .metric-value{font-size:28px;font-weight:800;letter-spacing:-.6px;color:var(--ink);line-height:1}
    .metric-desc{font-size:11px;color:var(--muted-2);margin-top:4px}

    /* BADGES */
    .badge{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
    .badge-default{background:var(--indigo-light);color:#3730a3}
    .badge-critical,.badge-high{background:var(--red-bg);color:var(--red-text)}
    .badge-medium{background:var(--amber-bg);color:var(--amber-text)}
    .badge-low,.badge-info,.badge-debug{background:var(--green-bg);color:var(--green-text)}
    .badge-completed,.badge-ready_for_automation,.badge-ok{background:var(--green-bg);color:var(--green-text)}
    .badge-failed,.badge-down,.badge-error{background:var(--red-bg);color:var(--red-text)}
    .badge-pending_approval,.badge-pending{background:var(--amber-bg);color:var(--amber-text)}
    .badge-recommended,.badge-suggested,.badge-active{background:var(--indigo-light);color:#3730a3}
    .badge-approved{background:var(--blue-bg);color:var(--blue-text)}
    .badge-rejected,.badge-disabled,.badge-offline{background:#f3f4f6;color:#6b7280}
    .badge-optional{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
    .badge-connected{background:var(--green-bg);color:var(--green-text)}

    /* DOT */
    .dot{display:inline-block;width:7px;height:7px;border-radius:50%}
    .dot-ok{background:var(--green)}
    .dot-bad{background:var(--red)}
    .dot-warn{background:var(--amber)}
    .dot-lg{width:10px;height:10px}

    /* TABLES */
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);background:#fafbfd;white-space:nowrap}
    td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;overflow-wrap:anywhere}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#fafbfd}
    .td-muted{color:var(--muted);font-size:12px}
    .td-mono{font-family:ui-monospace,monospace;font-size:11px}
    .td-fw{font-weight:600}

    /* TIMELINE */
    .timeline{display:grid;gap:0}
    .tl-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
    .tl-item:last-child{border-bottom:none}
    .tl-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}
    .tl-event{background:#6366f1}
    .tl-insight{background:#0ea5e9}
    .tl-action{background:#16a34a}
    .tl-feedback{background:#d97706}
    .tl-meta{font-size:11px;color:var(--muted-2);margin-top:2px}

    /* EMPTY STATE */
    .empty-state{padding:40px 20px;text-align:center;color:var(--muted);font-size:13px}
    .empty-icon{font-size:28px;margin-bottom:12px}
    .empty-title{font-weight:700;color:var(--ink-2);font-size:15px;margin-bottom:6px}
    .empty-desc{color:var(--muted);line-height:1.6;max-width:340px;margin:0 auto}

    /* LOADING */
    .page-loading{display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--muted);font-size:13px;gap:8px}
    .spin{width:16px;height:16px;border:2px solid var(--line);border-top-color:var(--indigo);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
    @keyframes spin{to{transform:rotate(360deg)}}

    /* OVERVIEW */
    .overview-hero{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:var(--shadow-xs)}
    .hero-status{display:flex;align-items:center;gap:10px}
    .hero-status h1{font-size:16px;font-weight:700;color:var(--ink)}
    .loop-viz{font-family:ui-monospace,monospace;font-size:12px;font-weight:700;color:var(--indigo);letter-spacing:.1px;white-space:nowrap}

    /* TWO-COL */
    .two-col{display:grid;grid-template-columns:minmax(0,1.4fr) 320px;gap:16px;align-items:start}

    /* ATTENTION */
    .att-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}
    .att-item:last-child{border-bottom:none}

    /* EVENT LOOP DETAIL */
    .event-loop{background:#f8fafc;border-left:3px solid var(--indigo);padding:14px 16px}
    .loop-step{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
    .loop-step:last-child{margin-bottom:0}
    .loop-num{width:20px;height:20px;border-radius:50%;background:var(--indigo);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .loop-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:2px}
    .loop-body{font-size:13px;color:var(--ink-2);line-height:1.5}
    .loop-empty{font-size:12px;color:var(--muted-2);font-style:italic}

    /* AGENTS */
    .agents-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .agent-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;box-shadow:var(--shadow-xs)}
    .agent-name{font-size:14px;font-weight:700;color:var(--ink);margin-bottom:4px}
    .agent-desc{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px}
    .agent-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);padding:3px 0}
    .agent-val{font-weight:600;color:var(--ink-2)}

    /* INTEGRATIONS */
    .int-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:24px}
    .int-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow-xs)}
    .int-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .int-name{font-size:13px;font-weight:700;color:var(--ink)}
    .int-webhook{font-family:ui-monospace,monospace;font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:4px 8px;margin:6px 0;word-break:break-all}
    .int-footer{display:flex;gap:6px;margin-top:8px}

    /* CONFIG */
    .config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .config-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;gap:12px}
    .config-row:last-child{border-bottom:none}
    .config-key{color:var(--muted);flex-shrink:0}
    .config-val{font-weight:600;color:var(--ink-2);font-family:ui-monospace,monospace;font-size:12px;text-align:right;word-break:break-all}

    /* FILTERS */
    .filter-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
    .filter-select{height:32px;padding:0 10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:13px;background:#fff;color:var(--ink);outline:none}
    .filter-select:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(99,102,241,.12)}

    /* MEMORY */
    .search-row{display:flex;gap:8px;margin-bottom:12px}
    .search-input{flex:1;height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;font:inherit;font-size:13px;color:var(--ink);outline:none}
    .search-input:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(99,102,241,.12)}
    .example-queries{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
    .example-q{padding:4px 10px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--muted);cursor:pointer;background:var(--panel);transition:background .1s,border-color .1s,color .1s}
    .example-q:hover{background:var(--indigo-light);border-color:var(--indigo);color:var(--indigo-dark)}
    .mem-result{border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin-bottom:8px}
    .mem-score{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}

    /* LANGGRAPH FORM */
    .lg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
    .lg-field{display:grid;gap:4px;margin-bottom:10px}
    .field-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)}
    .lg-select{height:36px;padding:0 10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:13px;background:#fff;color:var(--ink);outline:none}
    .lg-select:focus{border-color:var(--indigo)}
    .lg-input{height:36px;padding:0 11px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:13px;color:var(--ink);outline:none}
    .lg-input:focus{border-color:var(--indigo)}
    .lg-textarea{width:100%;min-height:72px;padding:8px 11px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:13px;color:var(--ink);resize:vertical;outline:none}
    .lg-textarea:focus{border-color:var(--indigo)}
    .lg-toggles{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px}
    .lg-toggle{display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;user-select:none}

    /* FLAGS */
    .flags-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .flag-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between}
    .flag-name{font-size:13px;font-weight:600;color:var(--ink-2)}
    .flag-on{color:var(--green);font-size:11px;font-weight:700}
    .flag-off{color:var(--muted-2);font-size:11px;font-weight:700}

    /* LOG */
    .log-box{background:#0f172a;color:#94a3b8;border-radius:8px;padding:12px 14px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;max-height:280px;overflow:auto;border:1px solid #1e293b}

    /* RESPONSIVE */
    @media(max-width:1100px){.two-col{grid-template-columns:1fr}.int-grid{grid-template-columns:repeat(2,1fr)}.agents-grid{grid-template-columns:1fr}.metrics-grid{grid-template-columns:repeat(3,1fr)}.config-grid{grid-template-columns:1fr}}
    @media(max-width:768px){:root{--nav-w:0px}.sidebar{display:none}.metrics-grid{grid-template-columns:repeat(2,1fr)}.int-grid{grid-template-columns:1fr}.flags-grid{grid-template-columns:1fr}.page-wrap{padding:16px}.loop-viz{display:none}}

    /* LOG VIEWER */
    .logs-shell{display:flex;height:calc(100vh - var(--topnav-h));overflow:hidden}
    .log-sidebar{width:240px;flex-shrink:0;background:var(--panel);border-right:1px solid var(--line);display:flex;flex-direction:column;overflow:hidden}
    .log-sidebar-head{padding:12px 14px;border-bottom:1px solid var(--line);font-size:12px;font-weight:700;color:var(--ink-2)}
    .log-sidebar-body{flex:1;overflow-y:auto;padding:10px 8px}
    .cgroup-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);padding:8px 6px 4px;display:block}
    .citem{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;cursor:pointer;border:1px solid transparent;margin-bottom:1px}
    .citem:hover{background:var(--bg);border-color:var(--line)}
    .citem.active{background:var(--indigo-light);border-color:#c7d2fe}
    .citem-name{font-size:12px;font-weight:600;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
    .citem-img{font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
    .log-main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#0d1117}
    .log-topbar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#161b22;border-bottom:1px solid #30363d;flex-shrink:0}
    .log-title{font-size:13px;font-weight:700;color:#e6edf3;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .log-input{background:#0d1117;border:1px solid #30363d;border-radius:5px;padding:4px 9px;color:#e6edf3;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;width:200px}
    .log-input::placeholder{color:#484f58}
    .log-select{background:#0d1117;border:1px solid #30363d;border-radius:5px;padding:4px 8px;color:#8b949e;font-size:12px}
    .log-btn{background:#21262d;border:1px solid #30363d;border-radius:5px;padding:4px 10px;color:#8b949e;font-size:12px;cursor:pointer}
    .log-btn:hover{background:#30363d;color:#e6edf3}
    .log-body{flex:1;overflow-y:auto;padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.55}
    .log-line{white-space:pre-wrap;word-break:break-all;padding:1px 0;color:#8b949e}
    .log-line.stderr{color:#ff7b72}
    .log-line.stdout{color:#e6edf3}
    .log-empty{padding:32px;text-align:center;color:#484f58;font-style:italic;font-size:13px}
  </style>
</head>
<body>
  ${TOPNAV}

  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-section">
        <span class="sidebar-label">reduOS</span>
        <button class="nav-item active" data-page="overview">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
          Overview
        </button>
        <button class="nav-item" data-page="events">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v3.75L10.5 10"/></svg>
          Events
        </button>
        <button class="nav-item" data-page="insights">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="7" r="4.5"/><path d="M6.5 11.5 8 15l1.5-3.5M5 9.5l-2.5 2M11 9.5l2.5 2"/></svg>
          Insights
        </button>
        <button class="nav-item" data-page="actions">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8l10-5-5 10-1.5-4.5L3 8z"/></svg>
          Actions
        </button>
        <button class="nav-item" data-page="memory">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="8" cy="5" rx="5.5" ry="2.5"/><path d="M2.5 5v3c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5V5"/><path d="M2.5 8v3c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5V8"/></svg>
          Memory
        </button>
        <button class="nav-item" data-page="agents">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="12" height="9" rx="2"/><path d="M5 5V4a3 3 0 0 1 6 0v1M6 10h.01M10 10h.01"/></svg>
          Agents
        </button>
        <button class="nav-item" data-page="integrations">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3.5 13 8l-4 4.5M7 3.5 3 8l4 4.5"/></svg>
          Integrations
        </button>
        <button class="nav-item" data-page="ai-config">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
          AI Config
        </button>
        <button class="nav-item" data-page="feedback">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 10V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5l-3 3V10z"/></svg>
          Feedback
        </button>
        <button class="nav-item" data-page="settings">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06"/></svg>
          Settings
        </button>
        <button class="nav-item" data-page="logs">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 5.5h6M5 8h6M5 10.5h4"/></svg>
          Logs
        </button>
      </div>
      <div class="sidebar-footer">
        <button class="sign-out-btn" id="sidebar-signout">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3m3-11 4 4-4 4m4-4H6"/></svg>
          Sign Out
        </button>
      </div>
    </aside>

    <!-- Content -->
    <main class="main-content">
      <div id="page-content" class="page-loading">
        <div class="spin"></div> Loading&hellip;
      </div>
    </main>
  </div>

  <script>
    /* ─── utils ──────────────────────────────────────────── */
    const $ = id => document.getElementById(id);
    const esc = v => String(v??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const trunc = (v, n=160) => { const s=String(v??''); return s.length>n ? s.slice(0,n-1)+'...' : s; };
    const fmtDate = v => v ? new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '--';
    const badge = (v, cls) => { const n = String(v??'').toLowerCase().replace(/[^a-z0-9_-]/g,'-'); return '<span class="badge badge-'+(cls||n)+'">'+esc(v??'--')+'</span>'; };
    const dot   = ok => '<span class="dot '+(ok?'dot-ok':'dot-bad')+'"></span>';
    const mkMetric = (label,value,desc) => '<div class="metric-card"><div class="metric-label">'+esc(label)+'</div><div class="metric-value">'+esc(String(value))+'</div><div class="metric-desc">'+esc(desc)+'</div></div>';
    const empty = (icon,title,desc) => '<div class="empty-state"><div class="empty-icon">'+icon+'</div><div class="empty-title">'+esc(title)+'</div><div class="empty-desc">'+esc(desc)+'</div></div>';

    /* ─── api ────────────────────────────────────────────── */
    async function api(path, opts) {
      const r = await fetch(path, opts||{});
      if (r.status===401) { window.location.href='/login'; throw new Error('auth'); }
      const j = await r.json();
      if (!r.ok||j.ok===false) throw new Error(j.error||'Request failed');
      return j;
    }

    /* ─── router ─────────────────────────────────────────── */
    const VALID = new Set(['overview','events','insights','actions','memory','agents','integrations','ai-config','feedback','settings','logs']);
    let CUR = 'overview';

    function go(page) {
      if (!VALID.has(page)) page='overview';
      CUR = page;
      window.history.pushState(null,'','#'+page);
      activate(page);
      renderPage(page);
    }
    window.go = go;

    function activate(page) {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page===page));
    }

    async function renderPage(page) {
      const el = $('page-content');
      // logs page takes full viewport height — skip the page-loading wrapper
      el.className = page === 'logs' ? '' : 'page-loading';
      el.innerHTML = page === 'logs' ? '' : '<div class="spin"></div> Loading…';
      // main-content: overflow hidden for logs, auto for everything else
      document.querySelector('.main-content').style.overflow = page === 'logs' ? 'hidden' : '';
      try {
        const html = await PAGES[page]();
        el.className = '';
        el.innerHTML = html;
        BIND[page]&&BIND[page]();
      } catch(e) {
        el.className = 'page-wrap';
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error loading page</div><div class="empty-desc">'+esc(e.message)+'</div><button class="btn btn-sm" style="margin-top:12px" onclick="renderPage(&apos;'+page+'&apos;)">Retry</button></div>';
      }
    }

    /* ═══════════════════════════════════════════════════════
       OVERVIEW
    ═══════════════════════════════════════════════════════ */
    async function pgOverview() {
      const d = await api('/api/summary');
      const sv = d.services||{};
      const ev = d.events||[], ins = d.insights||[], act = d.actions||[], fb = d.feedback||[];
      const failed = act.filter(a=>a.status==='failed');
      const pending = act.filter(a=>a.status==='pending_approval');
      const downSvcs = Object.entries(sv).filter(([,ok])=>!ok);
      const svcOk = Object.values(sv).filter(Boolean).length;

      const attention = [
        ...failed.map(a=>({ico:'&#10060;', txt:'Failed action: '+esc(a.action_type), sub:esc(a.target||'')})),
        ...pending.map(a=>({ico:'&#9203;',  txt:'Pending approval: '+esc(a.action_type), sub:'needs manual review'})),
        ...downSvcs.map(([n])=>({ico:'&#128308;', txt:'Service down: '+esc(n), sub:'check integrations'})),
      ].slice(0,6);

      const timeline = [
        ...ev.slice(0,4).map(x=>({...x,_k:'event'})),
        ...ins.slice(0,3).map(x=>({...x,_k:'insight'})),
        ...act.slice(0,3).map(x=>({...x,_k:'action'})),
        ...fb.slice(0,2).map(x=>({...x,_k:'feedback'})),
      ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,10);

      const c = d.counts||{};
      return '<div class="page-wrap">'+
        '<div class="overview-hero">'+
          '<div class="hero-status"><span class="dot dot-ok dot-lg"></span><h1>Your operative loop is running</h1></div>'+
          '<div class="loop-viz">Events &rarr; Memory &rarr; AI &rarr; Automation &rarr; Feedback</div>'+
        '</div>'+
        '<div class="metrics-grid">'+
          mkMetric('Events', c.events??'--','processed total')+
          mkMetric('Insights', c.insights??'--','AI generated')+
          mkMetric('Actions', c.actions??'--','automations')+
          mkMetric('Pending', pending.length,'needs approval')+
          mkMetric('Feedback', c.feedback??'--','outcomes')+
          mkMetric('Services', svcOk+'/'+Object.keys(sv).length,'connected')+
        '</div>'+
        '<div class="two-col">'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Recent Activity</span><button class="btn btn-sm" id="ov-refresh">Refresh</button></div>'+
              '<div style="padding:0 16px">'+
                (timeline.length ?
                  '<div class="timeline">'+
                  timeline.map(t=>'<div class="tl-item">'+
                    '<span class="tl-dot tl-'+esc(t._k)+'"></span>'+
                    '<div><div style="font-size:13px;color:var(--ink-2)">'+badge(t._k)+' &nbsp;'+esc(trunc(t.message||t.summary||t.result||t.feedback_type||t._k,100))+'</div>'+
                    '<div class="tl-meta">'+esc(fmtDate(t.created_at))+' &middot; '+esc(t.source||t.category||t.action_type||t.feedback_type||'')+'</div></div>'+
                  '</div>').join('')+
                  '</div>' :
                  empty('&#127744;','No activity yet','Send events using Quick Actions below.')
                )+
              '</div>'+
            '</div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Quick Actions</span><span style="font-size:12px;color:var(--muted)">Send sample events to test the loop</span></div>'+
              '<div class="card-body">'+
                '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">'+
                  '<button class="btn" data-event="support">&#128223; Demo Support Ticket</button>'+
                  '<button class="btn" data-event="reliability">&#128293; Demo Incident</button>'+
                  '<button class="btn" data-event="growth">&#128200; Demo Trial Signup</button>'+
                  '<button class="btn" data-event="product">&#128172; Demo Product Feedback</button>'+
                  '<button class="btn btn-primary" id="ov-demo-full">&#9654; Run Full Demo Loop</button>'+
                  '<button class="btn" onclick="go(&apos;memory&apos;)">&#128269; Search Memory</button>'+
                '</div>'+
                '<div class="log-box" id="ov-log" style="min-height:56px">Ready.</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Needs Attention</span>'+
                (attention.length ? badge(attention.length,'failed') : badge('All clear','completed'))+
              '</div>'+
              '<div style="padding:0 16px">'+
                (attention.length ?
                  attention.map(a=>'<div class="att-item"><span>'+a.ico+'</span><div><div>'+a.txt+'</div><div class="tl-meta">'+a.sub+'</div></div></div>').join('') :
                  empty('&#9989;','All clear','No failed actions or pending approvals.')
                )+
              '</div>'+
            '</div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Core Services</span></div>'+
              '<div style="padding:0 12px">'+
                Object.entries(sv).map(([name,ok])=>
                  '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--line);font-size:13px">'+
                    '<span style="font-weight:600;color:var(--ink-2)">'+esc(name)+'</span>'+
                    '<span style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:'+(ok?'var(--green)':'var(--red)')+'">'+dot(ok)+(ok?'OK':'DOWN')+'</span>'+
                  '</div>'
                ).join('')+
              '</div>'+
            '</div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Open</span></div>'+
              '<div class="card-body" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">'+
                Object.entries(d.links||{}).map(([n,url])=>
                  '<a href="'+esc(url)+'" target="_blank" rel="noreferrer" class="btn btn-sm">'+esc(n.replaceAll('_',' '))+'</a>'
                ).join('')+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    /* ═══════════════════════════════════════════════════════
       EVENTS
    ═══════════════════════════════════════════════════════ */
    async function pgEvents() {
      const src = document.querySelector('[data-filter="ev-src"]')?.value||'';
      const sev = document.querySelector('[data-filter="ev-sev"]')?.value||'';
      const qs = new URLSearchParams({limit:'50'});
      if(src) qs.set('source',src);
      if(sev) qs.set('severity',sev);
      const d = await api('/api/events?'+qs);
      const items = d.items||[];

      const SRCS = ['glitchtip','zammad','uptime-kuma','umami','listmonk','dashboard','custom'];
      const SEVS = ['critical','high','medium','low','info','debug'];

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Events</div>'+
          '<div class="page-sub">Unified event timeline across all sources. Review events, insights, actions, and feedback from one place.</div></div>'+
        '<div class="filter-bar">'+
          '<select class="filter-select" data-filter="ev-src" onchange="go(&apos;events&apos;)">'+
            '<option value="">All sources</option>'+
            SRCS.map(s=>'<option value="'+s+'"'+(src===s?' selected':'')+'>'+s+'</option>').join('')+
          '</select>'+
          '<select class="filter-select" data-filter="ev-sev" onchange="go(&apos;events&apos;)">'+
            '<option value="">All severities</option>'+
            SEVS.map(s=>'<option value="'+s+'"'+(sev===s?' selected':'')+'>'+s+'</option>').join('')+
          '</select>'+
          '<span style="font-size:13px;color:var(--muted)">'+items.length+' events</span>'+
        '</div>'+
        '<div class="card"><table><thead><tr>'+
          '<th style="width:130px">Time</th>'+
          '<th style="width:115px">Source</th>'+
          '<th style="width:85px">Severity</th>'+
          '<th style="width:180px">Type</th>'+
          '<th>Message</th>'+
          '<th style="width:70px">Loop</th>'+
        '</tr></thead><tbody>'+
        (items.length ?
          items.map(e=>'<tr>'+
            '<td class="td-muted">'+esc(fmtDate(e.created_at))+'</td>'+
            '<td>'+badge(e.source,'default')+'</td>'+
            '<td>'+badge(e.severity)+'</td>'+
            '<td class="td-mono">'+esc(trunc(e.type,40))+'</td>'+
            '<td>'+esc(trunc(e.message,120))+'</td>'+
            '<td><button class="btn btn-sm btn-ghost ev-btn" data-id="'+esc(e.id)+'">View</button></td>'+
          '</tr>'+
          '<tr class="ev-detail-row" id="evd-'+esc(e.id)+'" style="display:none"><td colspan="6" style="padding:0"><div class="event-loop" id="evdb-'+esc(e.id)+'"><div class="page-loading" style="min-height:80px"><div class="spin"></div> Loading…</div></div></td></tr>'
          ).join('') :
          '<tr><td colspan="6">'+empty('&#128225;','No events yet','Send an event from Quick Actions or configure a source integration.')+'</td></tr>'
        )+
        '</tbody></table></div></div>';
    }

    async function loadEvtDetail(id) {
      const el = $('evdb-'+id); if(!el) return;
      try {
        const d = await api('/api/events/'+id);
        const e=d.event||{}, ins=d.insights||[], acts=d.actions||[], fb=d.feedback||[];
        const step = (n,label,body) => '<div class="loop-step"><div class="loop-num">'+n+'</div><div style="flex:1"><div class="loop-label">'+label+'</div>'+body+'</div></div>';
        el.innerHTML =
          step(1,'Event','<div class="loop-body">'+badge(e.severity)+' '+badge(e.source,'default')+' <strong>'+esc(e.type)+'</strong><br>'+esc(e.message)+'</div>')+
          step(2,'Memory / Context','<div class="loop-empty">Context retrieved from Qdrant at processing time.</div>')+
          step(3,'AI Insight',ins.length ?
            ins.map(i=>'<div class="loop-body">'+badge(i.priority)+' '+badge(i.category,'default')+'<br><em>'+esc(trunc(i.summary,200))+'</em><br><small style="color:var(--muted)">Action: '+esc(trunc(i.recommended_action,120))+'</small></div>').join('') :
            '<div class="loop-empty">No AI insight generated yet.</div>')+
          step(4,'Recommended / Triggered Action',acts.length ?
            acts.map(a=>'<div class="loop-body">'+badge(a.status)+' <strong>'+esc(a.action_type)+'</strong>'+(a.target?' &rarr; '+esc(a.target):'')+'</div>').join('') :
            '<div class="loop-empty">No action triggered.</div>')+
          step(5,'Feedback / Outcome',fb.length ?
            fb.map(f=>'<div class="loop-body">'+badge(f.feedback_type,'default')+' score: '+(f.score??'--')+' &middot; '+esc(f.result||'--')+'</div>').join('') :
            '<div class="loop-empty">No feedback recorded.</div>');
      } catch(e) { el.innerHTML='<div style="color:var(--red);font-size:13px;padding:8px">'+esc(e.message)+'</div>'; }
    }

    /* ═══════════════════════════════════════════════════════
       INSIGHTS
    ═══════════════════════════════════════════════════════ */
    async function pgInsights() {
      const pri = document.querySelector('[data-filter="ins-pri"]')?.value||'';
      const qs  = new URLSearchParams({limit:'50'});
      if(pri) qs.set('priority',pri);
      const d = await api('/api/insights?'+qs);
      const items = d.items||[];

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Insights</div>'+
          '<div class="page-sub">What AI concluded &mdash; from event context to recommended action.</div></div>'+
        '<div class="filter-bar">'+
          '<select class="filter-select" data-filter="ins-pri" onchange="go(&apos;insights&apos;)">'+
            '<option value="">All priorities</option>'+
            ['critical','high','medium','low'].map(p=>'<option value="'+p+'"'+(pri===p?' selected':'')+'>'+p+'</option>').join('')+
          '</select>'+
          '<span style="font-size:13px;color:var(--muted)">'+items.length+' insights</span>'+
        '</div>'+
        (items.length ?
          items.map(i=>{
            const ev=i.startup_events||{};
            return '<div class="card" style="margin-bottom:10px"><div style="padding:14px 16px">'+
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">'+
                '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">'+badge(i.priority)+badge(i.category,'default')+(i.sentiment?'<span style="font-size:12px;color:var(--muted)">'+esc(i.sentiment)+'</span>':'')+'</div>'+
                '<span style="font-size:11px;color:var(--muted-2);white-space:nowrap;flex-shrink:0">'+esc(fmtDate(i.created_at))+'</span>'+
              '</div>'+
              '<div style="font-size:14px;color:var(--ink-2);line-height:1.55;margin-bottom:10px">'+esc(i.summary)+'</div>'+
              '<div style="font-size:12px;color:var(--muted);margin-bottom:8px"><strong>Recommended:</strong> '+esc(i.recommended_action||'--')+'</div>'+
              '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted-2)">'+
                (i.ai_model?'<span>Model: '+esc(i.ai_model)+'</span>':'')+
                (ev.type?'<span>From: '+esc(ev.type)+' &middot; '+esc(ev.source)+'</span>':'')+
              '</div>'+
            '</div></div>';
          }).join('') :
          '<div class="card">'+empty('&#129504;','No insights yet','AI insights are generated automatically when events are processed. Send an event or run the demo to see insights here.')+'</div>'
        )+
      '</div>';
    }

    /* ═══════════════════════════════════════════════════════
       ACTIONS
    ═══════════════════════════════════════════════════════ */
    async function pgActions() {
      const st = document.querySelector('[data-filter="act-st"]')?.value||'';
      const qs = new URLSearchParams({limit:'50'});
      if(st) qs.set('status',st);
      const d = await api('/api/actions?'+qs);
      const items = d.items||[];

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Actions</div>'+
          '<div class="page-sub">Connect tools, remember what happened, reason over context, and automate the next step.</div></div>'+
        '<div class="filter-bar">'+
          '<select class="filter-select" data-filter="act-st" onchange="go(&apos;actions&apos;)">'+
            '<option value="">All statuses</option>'+
            ['suggested','pending_approval','approved','triggered','completed','failed','rejected'].map(s=>'<option value="'+s+'"'+(st===s?' selected':'')+'>'+s+'</option>').join('')+
          '</select>'+
          '<span style="font-size:13px;color:var(--muted)">'+items.length+' actions</span>'+
        '</div>'+
        '<div class="card"><table><thead><tr>'+
          '<th style="width:130px">Time</th>'+
          '<th style="width:170px">Action Type</th>'+
          '<th style="width:110px">Status</th>'+
          '<th style="width:140px">Target</th>'+
          '<th>Event</th>'+
          '<th style="width:170px">Controls</th>'+
        '</tr></thead><tbody>'+
        (items.length ?
          items.map(a=>{
            const ev=a.startup_events||{};
            const canApprove = a.status==='pending_approval'||a.status==='suggested';
            const canComplete = a.status==='approved'||a.status==='triggered';
            return '<tr>'+
              '<td class="td-muted">'+esc(fmtDate(a.created_at))+'</td>'+
              '<td class="td-fw">'+esc(a.action_type)+'</td>'+
              '<td>'+badge(a.status)+'</td>'+
              '<td class="td-muted">'+esc(a.target||'--')+'</td>'+
              '<td class="td-muted">'+esc(trunc(ev.type||ev.message||'--',80))+'</td>'+
              '<td>'+
                (canApprove ?
                  '<button class="btn btn-sm btn-success act-approve" data-id="'+esc(a.id)+'" style="margin-right:4px">&#10003; Approve</button>'+
                  '<button class="btn btn-sm btn-danger act-reject" data-id="'+esc(a.id)+'">&#10007; Reject</button>' :
                  canComplete ?
                  '<button class="btn btn-sm act-complete" data-id="'+esc(a.id)+'">&#10003; Mark done</button>' :
                  '<span style="font-size:12px;color:var(--muted-2)">'+esc(a.completed_at?fmtDate(a.completed_at):'--')+'</span>'
                )+
              '</td>'+
            '</tr>';
          }).join('') :
          '<tr><td colspan="6">'+empty('&#9654;','No actions yet','Actions are created when events are processed. Send events or run the demo.')+'</td></tr>'
        )+
        '</tbody></table></div></div>';
    }

    /* ═══════════════════════════════════════════════════════
       MEMORY
    ═══════════════════════════════════════════════════════ */
    async function pgMemory() {
      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Memory</div>'+
          '<div class="page-sub">Memory helps reduOS use previous events and outcomes when making future recommendations.</div></div>'+
        '<div class="two-col">'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Search Operational Memory</span></div>'+
              '<div class="card-body">'+
                '<div class="search-row">'+
                  '<input class="search-input" id="mem-q" placeholder="Search operational memory..." value="customers blocked during onboarding"/>'+
                  '<button class="btn btn-primary" id="mem-go">Search</button>'+
                '</div>'+
                '<div class="example-queries">'+
                  ['Show similar incidents to API outage','What happened last time payment failed?','Which support issues repeat most?','Find onboarding drop-off events'].map(q=>
                    '<span class="example-q" data-q="'+esc(q)+'">'+esc(q)+'</span>'
                  ).join('')+
                '</div>'+
                '<div id="mem-results">'+empty('&#128190;','Memory is ready','Send events or run a demo to build context. Then search across past events, outcomes, and patterns.')+'</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">About Memory</span></div>'+
              '<div class="card-body">'+
                '<p class="card-desc" style="margin-bottom:12px">reduOS stores every processed event as a vector in Qdrant. When a new event arrives, the AI retrieves the most similar past events to provide context for its reasoning.</p>'+
                '<p class="card-desc" style="margin-bottom:12px">This lets the system reason: <em>"Last time this happened, we did X and it worked."</em></p>'+
                '<div style="font-size:12px;color:var(--muted-2);display:grid;gap:6px;margin-top:12px;font-family:ui-monospace,monospace">'+
                  '<div>Collection: redu_os_events</div>'+
                  '<div>Embedding: nomic-embed-text (768-dim)</div>'+
                  '<div>Similarity: cosine</div>'+
                '</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    async function doMemSearch(q) {
      const el=$('mem-results');
      el.innerHTML='<div class="page-loading" style="min-height:80px"><div class="spin"></div> Searching…</div>';
      try {
        const d=await api('/api/memory/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,limit:6})});
        const items=d.items||[];
        if(!items.length){el.innerHTML=empty('&#128270;','No matches','No similar events found. Try a different query.');return;}
        el.innerHTML=items.map(it=>
          '<div class="mem-result">'+
            '<div class="mem-score">Score '+Math.round((it.score||0)*100)+'%</div>'+
            '<div style="font-size:13px;color:var(--ink-2);margin-bottom:3px">'+esc(trunc(it.event?.message||it.event?.type||'event',200))+'</div>'+
            '<div style="font-size:11px;color:var(--muted-2)">'+esc(it.event?.source||'')+' &middot; '+esc(fmtDate(it.event?.created_at))+'</div>'+
          '</div>'
        ).join('');
      } catch(e){el.innerHTML='<div style="color:var(--red);font-size:13px">'+esc(e.message)+'</div>';}
    }

    /* ═══════════════════════════════════════════════════════
       AGENTS
    ═══════════════════════════════════════════════════════ */
    async function pgAgents() {
      let lgOk = false;
      try { const h=await api('/api/langgraph/health'); lgOk=h.ok===true; } catch{}

      const AGENTS = [
        {id:'incident',  emoji:'&#128293;', name:'Incident Responder',  desc:'Handles uptime alerts, error spikes, and production incidents. Retrieves similar past incidents from memory and recommends immediate response actions.', events:'uptime-kuma, GlitchTip, generic', approval:'auto',   memory:'yes', automation:'yes'},
        {id:'support',   emoji:'&#128223;', name:'Support Operator',    desc:'Processes support tickets from Zammad and in-app messages. Identifies repeat issues and surfaces resolution paths from past outcomes.', events:'Zammad, dashboard', approval:'auto',   memory:'yes', automation:'yes'},
        {id:'onboarding',emoji:'&#128640;', name:'Onboarding Agent',    desc:'Tracks user onboarding events from Umami and Listmonk. Flags stuck users and recommends outreach or product improvements.', events:'Umami, Listmonk', approval:'review', memory:'yes', automation:'optional'},
        {id:'product-signal',emoji:'&#128200;', name:'Product Signal Agent', desc:'Aggregates product feedback and usage patterns. Surfaces recurring themes and connects them to growth or retention signals.', events:'Umami, generic', approval:'auto',   memory:'yes', automation:'optional'},
      ];

      return '<div class="page-wrap">'+
        '<div class="page-head">'+
          '<div style="display:flex;align-items:center;justify-content:space-between">'+
            '<div><div class="page-title">Agents</div><div class="page-sub">AI workflows that turn events into actions. Powered by LangGraph.</div></div>'+
            '<span style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:5px 10px;border-radius:6px;background:'+(lgOk?'var(--green-bg)':'var(--red-bg)')+';color:'+(lgOk?'var(--green-text)':'var(--red-text)')+'">'+dot(lgOk)+'LangGraph '+(lgOk?'connected':'offline')+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="agents-grid" style="margin-bottom:20px">'+
          AGENTS.map(a=>'<div class="agent-card">'+
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">'+
              '<span style="font-size:22px">'+a.emoji+'</span>'+
              badge(lgOk?'Active':'Offline', lgOk?'active':'offline')+
            '</div>'+
            '<div class="agent-name">'+esc(a.name)+'</div>'+
            '<div class="agent-desc">'+esc(a.desc)+'</div>'+
            '<div>'+
              '<div class="agent-row"><span>Event sources</span><span class="agent-val">'+esc(a.events)+'</span></div>'+
              '<div class="agent-row"><span>Approval mode</span><span class="agent-val">'+esc(a.approval)+'</span></div>'+
              '<div class="agent-row"><span>Memory</span><span class="agent-val">'+esc(a.memory)+'</span></div>'+
              '<div class="agent-row"><span>Automation</span><span class="agent-val">'+esc(a.automation)+'</span></div>'+
            '</div>'+
            '<button class="btn btn-sm btn-indigo agent-run" data-mode="'+esc(a.id)+'" style="margin-top:12px;width:100%">Invoke agent &rarr;</button>'+
          '</div>').join('')+
        '</div>'+
        '<div class="card">'+
          '<div class="card-head"><span class="card-title">Invoke Agent</span><span style="font-size:12px;color:var(--muted)">Ctrl+Enter to run</span></div>'+
          '<div class="card-body">'+
            '<div class="lg-grid">'+
              '<div class="lg-field"><div class="field-label">Agent</div>'+
                '<select id="lg-mode" class="lg-select"><option value="support">Support Operator</option><option value="incident">Incident Responder</option><option value="onboarding">Onboarding Agent</option><option value="product-signal">Product Signal Agent</option></select>'+
              '</div>'+
              '<div class="lg-field"><div class="field-label">Severity</div>'+
                '<select id="lg-severity" class="lg-select"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select>'+
              '</div>'+
            '</div>'+
            '<div class="lg-field"><div class="field-label">Message</div><textarea id="lg-message" class="lg-textarea" placeholder="Describe the event or situation..."></textarea></div>'+
            '<div class="lg-field"><div class="field-label">User Email <span style="opacity:.5;font-weight:400;text-transform:none">(optional)</span></div><input id="lg-email" class="lg-input" type="email" placeholder="user@example.com"/></div>'+
            '<div class="lg-toggles">'+
              '<label class="lg-toggle"><input type="checkbox" id="lg-record"/> Record to collector</label>'+
              '<label class="lg-toggle"><input type="checkbox" id="lg-automate"/> Trigger automation</label>'+
            '</div>'+
            '<button id="lg-run" class="btn btn-indigo" style="width:100%">Run Agent</button>'+
            '<div id="lg-results" style="margin-top:12px"></div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    function runLg() {
      const msg=$('lg-message')?.value?.trim();
      if(!msg){$('lg-results').innerHTML='<div style="color:var(--muted-2);font-size:13px">Enter a message first.</div>';return;}
      const btn=$('lg-run'); btn.disabled=true;
      $('lg-results').innerHTML='<div class="page-loading" style="min-height:80px"><div class="spin"></div> Running agent workflow…</div>';
      api('/api/langgraph/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        mode:$('lg-mode')?.value, severity:$('lg-severity')?.value,
        message:msg, user_email:$('lg-email')?.value||undefined,
        record_to_collector:$('lg-record')?.checked, trigger_automation:$('lg-automate')?.checked
      })}).then(r=>{
        const i=r.insight||{}, a=r.action||{}, w=r.warnings||[];
        let h='<div style="display:grid;gap:8px">';
        h+='<div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px">Memory</div>';
        h+='<div style="font-size:13px;color:var(--muted)">'+(r.similar_context?.length||0)+' similar event(s) retrieved from Qdrant</div></div>';
        h+='<div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px">Insight</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">'+badge(i.priority||'--')+badge(i.category||'--','default')+(i.sentiment?'<span style="font-size:12px;color:var(--muted)">'+esc(i.sentiment)+'</span>':'')+'</div>';
        if(i.summary) h+='<div style="font-size:13px;line-height:1.55;margin-bottom:5px">'+esc(i.summary)+'</div>';
        if(i.recommended_action) h+='<div style="font-size:12px;color:var(--muted)"><strong>Action:</strong> '+esc(i.recommended_action)+'</div>';
        h+='</div>';
        h+='<div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px">Action</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px">'+badge(a.status||'--')+(a.requires_human_approval?'<span style="font-size:12px;color:var(--amber);font-weight:700">&#9888; Needs Approval</span>':'')+'</div>';
        if(a.action_type) h+='<div style="font-size:12px;color:var(--muted)">'+esc(a.action_type)+(a.target?' &rarr; '+esc(a.target):'')+'</div>';
        h+='</div>';
        if(w.length) h+='<div style="border:1px solid #fcd34d;border-radius:8px;background:#fffbeb;padding:10px 12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px">Warnings</div>'+w.map(x=>'<div style="font-size:12px;color:var(--amber)">'+esc(String(x))+'</div>').join('')+'</div>';
        h+='</div>';
        $('lg-results').innerHTML=h;
      }).catch(e=>{ $('lg-results').innerHTML='<div style="color:var(--red);font-size:13px">'+esc(e.message)+'</div>'; })
      .finally(()=>{btn.disabled=false;});
    }

    /* ═══════════════════════════════════════════════════════
       INTEGRATIONS
    ═══════════════════════════════════════════════════════ */
    async function pgIntegrations() {
      const d = await api('/api/summary');
      const sv = d.services||{};
      const cUrl = d.links?.collector||'http://127.0.0.1:3005';

      const INTS = [
        {cat:'Event Sources', name:'GlitchTip',  key:'glitchtip',   wh:cUrl+'/v1/events/glitchtip',   docs:'Error tracking. Configure webhook in GlitchTip project settings.', optional:false},
        {cat:'Event Sources', name:'Zammad',      key:'zammad',      wh:cUrl+'/v1/events/zammad',       docs:'Support tickets. Configure in Zammad Webhooks > Ticket created.',  optional:false},
        {cat:'Event Sources', name:'Uptime Kuma', key:'uptime-kuma', wh:cUrl+'/v1/events/uptime-kuma',  docs:'Uptime alerts. Configure in Uptime Kuma monitor > Notification.',  optional:false},
        {cat:'Event Sources', name:'Umami',       key:'umami',       wh:cUrl+'/v1/events/umami',        docs:'Analytics events. Use Umami > Send Data integration.',              optional:false},
        {cat:'Event Sources', name:'Listmonk',    key:'listmonk',    wh:cUrl+'/v1/events/listmonk',     docs:'Email list events. Configure in Listmonk webhook settings.',         optional:true},
        {cat:'Event Sources', name:'Custom App',  key:'collector',   wh:cUrl+'/v1/events',             docs:'Send any JSON event directly to the collector API with X-API-Key.',  optional:true},
        {cat:'AI / ML',       name:'Ollama',      key:'ollama',      wh:d.links?.ollama||'http://127.0.0.1:11435', docs:'Local LLM host. deepseek-r1:1.5b for reasoning, nomic-embed-text for embeddings.', optional:false},
        {cat:'AI / ML',       name:'LiteLLM',     key:'litellm',     wh:'http://127.0.0.1:4000',        docs:'AI gateway for routing to local or cloud models (OpenAI, Anthropic, Groq).', optional:true},
        {cat:'AI / ML',       name:'Langfuse',    key:'langfuse',    wh:'http://127.0.0.1:3003',        docs:'LLM observability and tracing. View prompts, completions, and latencies.', optional:true},
        {cat:'Storage',       name:'Supabase',    key:'supabase',    wh:d.links?.supabase_api||'http://127.0.0.1:8000', docs:'Postgres + REST API. Stores events, insights, actions, and feedback.', optional:false},
        {cat:'Storage',       name:'Qdrant',      key:'qdrant',      wh:d.links?.qdrant||'http://127.0.0.1:6333', docs:'Vector memory. Stores event embeddings for similarity search.', optional:false},
        {cat:'Automation',    name:'Activepieces', key:'activepieces', wh:d.links?.activepieces||'http://127.0.0.1:8080', docs:'No-code automation. Receives webhook triggers from reduOS actions.', optional:false},
      ];

      const cats = [...new Set(INTS.map(i=>i.cat))];
      const isEventSrc = cat => cat==='Event Sources';

      let html = '<div class="page-wrap"><div class="page-head"><div class="page-title">Integrations</div>'+
        '<div class="page-sub">Connect tools, configure webhooks, and verify service health.</div></div>';

      cats.forEach(cat=>{
        const items=INTS.filter(i=>i.cat===cat);
        html+='<h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:0 0 10px">'+esc(cat)+'</h3>';
        html+='<div class="int-grid" style="margin-bottom:24px">';
        items.forEach(it=>{
          const ok=sv[it.key]===true, down=sv[it.key]===false;
          html+='<div class="int-card">'+
            '<div class="int-head">'+
              '<span class="int-name">'+esc(it.name)+'</span>'+
              (it.optional?badge('Optional','optional'):ok?badge('Connected','connected'):down?badge('Down','down'):badge('No status','disabled'))+
            '</div>'+
            '<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:8px">'+esc(it.docs)+'</div>'+
            (isEventSrc(cat)?
              '<div class="int-webhook">'+esc(it.wh)+'</div>'+
              '<div class="int-footer"><button class="btn btn-sm copy-url" data-url="'+esc(it.wh)+'">Copy URL</button></div>' :
              '<div class="int-footer"><a href="'+esc(it.wh)+'" target="_blank" rel="noreferrer" class="btn btn-sm">Open &nearr;</a></div>'
            )+
          '</div>';
        });
        html+='</div>';
      });

      return html+'</div>';
    }

    /* ═══════════════════════════════════════════════════════
       AI CONFIG
    ═══════════════════════════════════════════════════════ */
    async function pgAiConfig() {
      const d = await api('/api/ai-config');
      const cfgRow = (k,v) => '<div class="config-row"><span class="config-key">'+esc(k)+'</span><span class="config-val">'+esc(String(v??'--'))+'</span></div>';

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">AI Config</div>'+
          '<div class="page-sub">reduOS can run fully local or route model calls through LiteLLM.</div></div>'+
        '<div class="two-col">'+
          '<div>'+
            '<div class="card" style="margin-bottom:14px">'+
              '<div class="card-head"><span class="card-title">Active Configuration</span>'+
                badge(d.ai_enabled?'AI Enabled':'AI Disabled', d.ai_enabled?'completed':'disabled')+
              '</div>'+
              '<div class="card-body">'+
                cfgRow('Provider', d.ai_provider)+
                cfgRow('AI enabled', d.ai_enabled)+
                cfgRow('Qdrant memory', d.qdrant_enabled)+
                cfgRow('Langfuse tracing', d.langfuse_enabled)+
              '</div>'+
            '</div>'+
            '<div class="card" style="margin-bottom:14px">'+
              '<div class="card-head"><span class="card-title">Ollama</span>'+
                badge(d.ai_provider==='ollama'?'Active':'Standby', d.ai_provider==='ollama'?'completed':'disabled')+
              '</div>'+
              '<div class="card-body">'+
                cfgRow('URL', d.ollama?.url)+
                cfgRow('Chat model', d.ollama?.chat_model)+
                cfgRow('Embedding model', d.ollama?.embed_model)+
              '</div>'+
            '</div>'+
            (d.litellm?.base_url ?
              '<div class="card" style="margin-bottom:14px">'+
                '<div class="card-head"><span class="card-title">LiteLLM</span>'+
                  badge(d.ai_provider==='litellm'?'Active':'Standby', d.ai_provider==='litellm'?'completed':'disabled')+
                '</div>'+
                '<div class="card-body">'+
                  cfgRow('Base URL', d.litellm?.base_url)+
                  cfgRow('Model', d.litellm?.model)+
                  cfgRow('API key', d.litellm?.api_key_set?'configured (hidden)':'not set')+
                '</div>'+
              '</div>' : '')+
            (d.langfuse_enabled ?
              '<div class="card">'+
                '<div class="card-head"><span class="card-title">Langfuse Tracing</span>'+badge('Enabled','completed')+'</div>'+
                '<div class="card-body">'+
                  cfgRow('Host', d.langfuse_host)+
                  cfgRow('Public key', d.langfuse_public_key||'not set')+
                '</div>'+
              '</div>' : '')+
          '</div>'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">How It Works</span></div>'+
              '<div class="card-body">'+
                '<p class="card-desc" style="margin-bottom:12px">When an event arrives, reduOS:</p>'+
                '<ol style="padding-left:16px;font-size:13px;color:var(--muted);line-height:2">'+
                  '<li>Embeds the event with <strong>nomic-embed-text</strong></li>'+
                  '<li>Retrieves similar past events from <strong>Qdrant</strong></li>'+
                  '<li>Sends context to <strong>'+esc(d.ollama?.chat_model||'the configured model')+'</strong></li>'+
                  '<li>Parses the insight: priority, category, recommended action</li>'+
                  '<li>Triggers automation via <strong>Activepieces</strong> webhook</li>'+
                '</ol>'+
                '<p class="card-desc" style="margin-top:12px">If <strong>LiteLLM</strong> is active, all model calls are routed through it, enabling cloud models (OpenAI, Anthropic, Groq) without changing any application code.</p>'+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    /* ═══════════════════════════════════════════════════════
       FEEDBACK
    ═══════════════════════════════════════════════════════ */
    async function pgFeedback() {
      const d = await api('/api/feedback');
      const items = d.items||[];

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Feedback</div>'+
          '<div class="page-sub">Record what worked and what did not. Feedback helps the system learn and prioritise future actions.</div></div>'+
        (items.length ?
          '<div class="card" style="margin-bottom:16px"><table><thead><tr>'+
            '<th style="width:130px">Time</th>'+
            '<th style="width:150px">Type</th>'+
            '<th style="width:65px">Score</th>'+
            '<th>Event</th>'+
            '<th>Result</th>'+
          '</tr></thead><tbody>'+
          items.map(f=>{
            const ev=f.startup_events||{};
            return '<tr>'+
              '<td class="td-muted">'+esc(fmtDate(f.created_at))+'</td>'+
              '<td>'+badge(f.feedback_type,'default')+'</td>'+
              '<td style="font-weight:700;color:var(--ink-2)">'+(f.score!=null?f.score:'--')+'</td>'+
              '<td class="td-muted">'+esc(trunc(ev.type||'--',60))+'</td>'+
              '<td class="td-muted">'+esc(trunc(f.result||JSON.stringify(f.metadata||{}),120))+'</td>'+
            '</tr>';
          }).join('')+
          '</tbody></table></div>' :
          '<div class="card" style="margin-bottom:16px">'+empty('&#128077;','No feedback yet','Feedback is recorded when automations complete. You can also submit it manually below.')+'</div>'
        )+
        '<div class="card">'+
          '<div class="card-head"><span class="card-title">Submit Feedback</span></div>'+
          '<div class="card-body">'+
            '<div style="display:grid;gap:10px;max-width:480px">'+
              '<div class="lg-field"><div class="field-label">Event ID</div><input id="fb-eid" class="lg-input" placeholder="Paste event UUID..."/></div>'+
              '<div class="lg-field"><div class="field-label">Feedback Type</div>'+
                '<select id="fb-type" class="lg-select">'+
                  '<option value="helpful">Helpful</option>'+
                  '<option value="not_helpful">Not Helpful</option>'+
                  '<option value="correct_priority">Correct Priority</option>'+
                  '<option value="wrong_priority">Wrong Priority</option>'+
                  '<option value="automate_next">Automate Next Time</option>'+
                  '<option value="keep_manual">Keep Manual</option>'+
                '</select>'+
              '</div>'+
              '<div class="lg-field"><div class="field-label">Score (0&ndash;1, optional)</div><input id="fb-score" class="lg-input" type="number" min="0" max="1" step="0.1" placeholder="0.8"/></div>'+
              '<div class="lg-field"><div class="field-label">Notes</div><input id="fb-notes" class="lg-input" placeholder="What happened?"/></div>'+
              '<button id="fb-submit" class="btn btn-primary">Submit Feedback</button>'+
              '<div id="fb-msg" style="font-size:13px"></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    /* ═══════════════════════════════════════════════════════
       SETTINGS
    ═══════════════════════════════════════════════════════ */
    async function pgSettings() {
      const d = await api('/api/settings');
      const inst=d.instance||{}, feat=d.features||{}, urls=d.urls||{};
      const cfgRow = (k,v) => '<div class="config-row"><span class="config-key">'+esc(k)+'</span><span class="config-val">'+esc(String(v??'--'))+'</span></div>';

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Settings</div>'+
          '<div class="page-sub">Instance configuration and feature flags.</div></div>'+
        '<div class="two-col">'+
          '<div>'+
            '<div class="card" style="margin-bottom:14px">'+
              '<div class="card-head"><span class="card-title">Instance</span></div>'+
              '<div class="card-body">'+
                cfgRow('Name', inst.name)+
                cfgRow('Version', inst.version)+
                cfgRow('Dashboard auth', inst.dashboard_auth_enabled)+
                cfgRow('Collector API key', d.api_key_hint)+
              '</div>'+
            '</div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Service URLs</span></div>'+
              '<div class="card-body">'+
                Object.entries(urls).map(([k,v])=>cfgRow(k.replaceAll('_',' '),v)).join('')+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Feature Flags</span></div>'+
              '<div class="card-body">'+
                '<div class="flags-grid">'+
                  Object.entries(feat).map(([k,v])=>
                    '<div class="flag-card">'+
                      '<span class="flag-name">'+esc(k.replaceAll('_',' '))+'</span>'+
                      '<span class="'+(v?'flag-on':'flag-off')+'">'+(v?'ON':'OFF')+'</span>'+
                    '</div>'
                  ).join('')+
                '</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    /* ═══════════════════════════════════════════════════════
       LOGS
    ═══════════════════════════════════════════════════════ */
    async function pgLogs() {
      const d = await api('/api/containers');
      const containers = d.items || [];

      // Group by service family
      const groups = {};
      const ORDER = ['reduOS','Supabase','Zammad','Other'];
      for (const c of containers) {
        const n = c.name;
        let g = 'Other';
        if (n.startsWith('redu-os-')) g = 'reduOS';
        else if (n.startsWith('supabase-') || n.startsWith('realtime-')) g = 'Supabase';
        else if (n.startsWith('zammad_')) g = 'Zammad';
        if (!groups[g]) groups[g] = [];
        groups[g].push(c);
      }

      const listHtml = ORDER.filter(g => groups[g]?.length).map(g =>
        '<span class="cgroup-label">'+esc(g)+'</span>'+
        groups[g].map(c =>
          '<div class="citem" data-cname="'+esc(c.name)+'">'+
            '<div style="overflow:hidden">'+
              '<div class="citem-name" title="'+esc(c.name)+'">'+esc(c.name.replace('redu-os-',''))+'</div>'+
              '<div class="citem-img">'+esc(c.image)+'</div>'+
            '</div>'+
            '<span class="badge badge-'+(c.state==='running'?'completed':'failed')+'" style="flex-shrink:0;margin-left:4px">'+esc(c.state)+'</span>'+
          '</div>'
        ).join('')
      ).join('');

      return '<div class="logs-shell">'+
        '<div class="log-sidebar">'+
          '<div class="log-sidebar-head">'+containers.length+' containers</div>'+
          '<div class="log-sidebar-body" id="clist">'+listHtml+'</div>'+
        '</div>'+
        '<div class="log-main">'+
          '<div class="log-topbar">'+
            '<span class="log-title" id="log-title">Select a container</span>'+
            '<input id="log-filter" class="log-input" type="text" placeholder="Filter…" />'+
            '<select id="log-tail" class="log-select">'+
              '<option value="50">50 lines</option>'+
              '<option value="100">100 lines</option>'+
              '<option value="200" selected>200 lines</option>'+
              '<option value="500">500 lines</option>'+
              '<option value="1000">1000 lines</option>'+
            '</select>'+
            '<button id="log-refresh" class="log-btn">&#8635; Refresh</button>'+
          '</div>'+
          '<div class="log-body" id="log-body"><div class="log-empty">Select a container from the list</div></div>'+
        '</div>'+
      '</div>';
    }

    /* ─── page dispatch ─────────────────────────────────── */
    const PAGES = {
      overview:     pgOverview,
      events:       pgEvents,
      insights:     pgInsights,
      actions:      pgActions,
      memory:       pgMemory,
      agents:       pgAgents,
      integrations: pgIntegrations,
      'ai-config':  pgAiConfig,
      feedback:     pgFeedback,
      settings:     pgSettings,
      logs:         pgLogs,
    };

    /* ─── after-render bindings ─────────────────────────── */
    const BIND = {
      overview() {
        $('ov-refresh')?.addEventListener('click', ()=>renderPage('overview'));
        $('ov-demo-full')?.addEventListener('click', async function(){
          this.disabled=true; const lb=$('ov-log');
          lb.textContent='Running full demo loop...';
          try { const r=await api('/api/demo/full',{method:'POST'}); lb.textContent=[r.stdout,r.stderr].filter(Boolean).join('\\n'); setTimeout(()=>renderPage('overview'),600); }
          catch(e){lb.textContent=e.message;} finally{this.disabled=false;}
        });
        document.querySelectorAll('[data-event]').forEach(btn=>btn.addEventListener('click',async function(){
          this.disabled=true; const lb=$('ov-log');
          lb.textContent='Sending '+this.dataset.event+' event...';
          try { const r=await api('/api/event/'+this.dataset.event,{method:'POST'}); lb.textContent=JSON.stringify(r,null,2); setTimeout(()=>renderPage('overview'),600); }
          catch(e){lb.textContent=e.message;} finally{this.disabled=false;}
        }));
      },
      events() {
        document.querySelectorAll('.ev-btn').forEach(btn=>btn.addEventListener('click',async function(e){
          e.stopPropagation();
          const id=this.dataset.id;
          const row=$('evd-'+id);
          if(!row) return;
          const isOpen=row.style.display==='table-row';
          document.querySelectorAll('.ev-detail-row').forEach(r=>r.style.display='none');
          if(!isOpen){ row.style.display='table-row'; await loadEvtDetail(id); }
        }));
      },
      actions() {
        async function updAct(id,status,btn){
          btn.disabled=true;
          try { await api('/api/actions/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}); renderPage('actions'); }
          catch(e){alert(e.message);btn.disabled=false;}
        }
        document.querySelectorAll('.act-approve').forEach(b=>b.addEventListener('click',()=>updAct(b.dataset.id,'approved',b)));
        document.querySelectorAll('.act-reject').forEach(b=>b.addEventListener('click',()=>updAct(b.dataset.id,'rejected',b)));
        document.querySelectorAll('.act-complete').forEach(b=>b.addEventListener('click',()=>updAct(b.dataset.id,'completed',b)));
      },
      memory() {
        const run=()=>doMemSearch($('mem-q').value);
        $('mem-go')?.addEventListener('click',run);
        $('mem-q')?.addEventListener('keydown',e=>{if(e.key==='Enter')run();});
        document.querySelectorAll('.example-q').forEach(el=>el.addEventListener('click',()=>{$('mem-q').value=el.dataset.q;run();}));
        setTimeout(run,100);
      },
      agents() {
        document.querySelectorAll('.agent-run').forEach(btn=>btn.addEventListener('click',()=>{
          const m=$('lg-mode'); if(m) m.value=btn.dataset.mode;
          $('lg-message')?.focus();
        }));
        $('lg-run')?.addEventListener('click',runLg);
        $('lg-message')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))runLg();});
      },
      integrations() {
        document.querySelectorAll('.copy-url').forEach(btn=>btn.addEventListener('click',async function(){
          await navigator.clipboard.writeText(this.dataset.url).catch(()=>{});
          const o=this.textContent; this.textContent='Copied!';
          setTimeout(()=>this.textContent=o,1500);
        }));
      },
      feedback() {
        $('fb-submit')?.addEventListener('click',async function(){
          const eid=$('fb-eid')?.value?.trim(), msg=$('fb-msg');
          if(!eid){msg.textContent='Event ID is required.';msg.style.color='var(--red)';return;}
          this.disabled=true;
          try {
            await api('/api/feedback/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
              startup_event_id:eid, feedback_type:$('fb-type')?.value,
              score:$('fb-score')?.value?Number($('fb-score').value):undefined,
              result:$('fb-notes')?.value||undefined
            })});
            msg.textContent='Feedback submitted.'; msg.style.color='var(--green)';
            setTimeout(()=>renderPage('feedback'),500);
          } catch(e){msg.textContent=e.message;msg.style.color='var(--red)';this.disabled=false;}
        });
      },
      logs() {
        let current = null;

        async function loadLogs(name) {
          current = name;
          const tail = $('log-tail')?.value || '200';
          const filter = ($('log-filter')?.value || '').toLowerCase();
          const body = $('log-body');
          const title = $('log-title');
          if (!body) return;
          body.innerHTML = '<div class="log-empty">Loading…</div>';
          if (title) title.textContent = name;
          try {
            const d = await api('/api/containers/'+encodeURIComponent(name)+'/logs?tail='+tail);
            const lines = (d.lines || []).filter(l => !filter || l.text.toLowerCase().includes(filter));
            if (!lines.length) {
              body.innerHTML = '<div class="log-empty">'+(filter ? 'No lines match filter' : 'No logs')+'</div>';
              return;
            }
            body.innerHTML = lines.map(l =>
              '<div class="log-line '+l.stream+'">'+esc(l.text)+'</div>'
            ).join('');
            body.scrollTop = body.scrollHeight;
          } catch(e) {
            body.innerHTML = '<div class="log-empty" style="color:#ff7b72">'+esc(e.message)+'</div>';
          }
        }

        document.querySelectorAll('.citem').forEach(el => el.addEventListener('click', function() {
          document.querySelectorAll('.citem').forEach(x => x.classList.remove('active'));
          this.classList.add('active');
          loadLogs(this.dataset.cname);
        }));
        $('log-refresh')?.addEventListener('click', () => { if (current) loadLogs(current); });
        $('log-tail')?.addEventListener('change', () => { if (current) loadLogs(current); });
        $('log-filter')?.addEventListener('input', () => { if (current) loadLogs(current); });

        // Auto-select first container
        const first = document.querySelector('.citem');
        if (first) { first.classList.add('active'); loadLogs(first.dataset.cname); }
      }
    };

    /* ─── nav wiring ────────────────────────────────────── */
    document.querySelectorAll('.nav-item').forEach(el=>
      el.addEventListener('click',e=>{e.preventDefault(); go(el.dataset.page);})
    );
    $('sidebar-signout')?.addEventListener('click',async()=>{
      await fetch('/api/auth/logout',{method:'POST'});
      window.location.href='/login';
    });
    window.addEventListener('popstate',()=>{
      const pg=(window.location.hash.slice(1)||'overview').replace(/[^a-z0-9-]/g,'');
      const p=VALID.has(pg)?pg:'overview';
      CUR=p; activate(p); renderPage(p);
    });

    /* ─── init ──────────────────────────────────────────── */
    (function(){
      const pg=(window.location.hash.slice(1)||'overview').replace(/[^a-z0-9-]/g,'');
      const p=VALID.has(pg)?pg:'overview';
      CUR=p; activate(p); renderPage(p);
    })();
  </script>
</body>
</html>`;

await app.listen({ host: "0.0.0.0", port });
console.log(`reduOS dashboard listening on http://127.0.0.1:${port}`);
