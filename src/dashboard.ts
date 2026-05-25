import { execFile } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import Fastify from "fastify";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".local/supabase-local.env" });

const execFileAsync = promisify(execFile);

const port = Number(process.env.DASHBOARD_PORT ?? 3006);
const collectorUrl = process.env.COLLECTOR_URL ?? "http://127.0.0.1:3005";
const collectorApiKey = process.env.COLLECTOR_API_KEY ?? "change-me-please";
const qdrantUrl = process.env.QDRANT_URL?.replace("host.containers.internal", "127.0.0.1") ?? "http://127.0.0.1:6333";
const qdrantApiKey = process.env.QDRANT_API_KEY ?? "";
const qdrantCollection = process.env.QDRANT_COLLECTION ?? "redu_os_events";
const ollamaUrl = process.env.OLLAMA_URL?.replace("host.containers.internal", "127.0.0.1") ?? "http://127.0.0.1:11435";
const supabaseUrl = process.env.SUPABASE_URL?.replace("host.containers.internal", "127.0.0.1") ?? "http://127.0.0.1:8000";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseAnonKey = process.env.ANON_KEY ?? "";
const activepiecesUrl = process.env.AP_FRONTEND_URL ?? "http://127.0.0.1:8080";
const studioUrl = process.env.SUPABASE_STUDIO_URL ?? "http://127.0.0.1:3000";
const authEnabled = (process.env.DASHBOARD_AUTH_ENABLED ?? "true") !== "false";
const sessionSecret = process.env.DASHBOARD_SESSION_SECRET ?? process.env.JWT_SECRET ?? "dev-dashboard-secret";
const cookieName = "redu_os_dashboard_session";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

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
  const [collector, supabaseRest, qdrant, ollama, activepieces] = await Promise.all([
    httpOk(`${collectorUrl}/health`),
    httpOk(`${supabaseUrl}/rest/v1/`, {
      headers: process.env.ANON_KEY ? { apikey: process.env.ANON_KEY } : {}
    }),
    httpOk(`${qdrantUrl}/collections`, {
      headers: qdrantApiKey ? { "api-key": qdrantApiKey } : {}
    }),
    httpOk(`${ollamaUrl}/api/tags`),
    httpOk(activepiecesUrl)
  ]);

  return {
    collector,
    supabase: supabaseRest,
    qdrant,
    ollama,
    activepieces
  };
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
      activepieces: activepiecesUrl
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

app.get("/", async (_request, reply) => {
  reply.type("text/html");
  return dashboardHtml;
});

const loginHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>reduOS Dashboard Login</title>
  <style>
    :root {
      --bg: #f7f8fb;
      --panel: #ffffff;
      --ink: #17202a;
      --muted: #647184;
      --line: #d9dee8;
      --blue: #2563eb;
      --red: #b42318;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 24px;
    }

    main {
      width: min(420px, 100%);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.2;
    }

    p {
      margin: 8px 0 22px;
      color: var(--muted);
      font-size: 14px;
    }

    label {
      display: block;
      margin: 14px 0 6px;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 750;
      letter-spacing: 0;
    }

    input {
      width: 100%;
      min-height: 42px;
      border: 1px solid #b9c2d2;
      border-radius: 6px;
      padding: 0 12px;
      font: inherit;
      font-size: 14px;
    }

    button {
      width: 100%;
      min-height: 42px;
      margin-top: 18px;
      border: 1px solid var(--blue);
      border-radius: 6px;
      background: var(--blue);
      color: #fff;
      font: inherit;
      font-size: 14px;
      font-weight: 720;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.65;
      cursor: wait;
    }

    .error {
      min-height: 20px;
      margin-top: 14px;
      color: var(--red);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main>
    <h1>reduOS Dashboard</h1>
    <p>Sign in with the Supabase Auth dashboard user.</p>
    <form id="login-form">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required autofocus />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button id="submit" type="submit">Sign In</button>
      <div class="error" id="error"></div>
    </form>
  </main>

  <script>
    const form = document.getElementById("login-form");
    const button = document.getElementById("submit");
    const error = document.getElementById("error");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      error.textContent = "";

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
          })
        });

        const body = await response.json();
        if (!response.ok || body.ok === false) {
          throw new Error(body.error || "Login failed");
        }

        window.location.href = "/";
      } catch (err) {
        error.textContent = err.message;
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;

const dashboardHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>reduOS Local Dashboard</title>
  <style>
    :root {
      --bg: #f7f8fb;
      --panel: #ffffff;
      --ink: #17202a;
      --muted: #647184;
      --line: #d9dee8;
      --blue: #2563eb;
      --green: #15803d;
      --red: #b42318;
      --amber: #b45309;
      --violet: #6d28d9;
      --shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
    }

    header {
      border-bottom: 1px solid var(--line);
      background: #fff;
    }

    .wrap {
      width: min(1440px, calc(100vw - 32px));
      margin: 0 auto;
    }

    .topbar {
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.2;
      font-weight: 720;
    }

    .sub {
      color: var(--muted);
      font-size: 13px;
      margin-top: 4px;
    }

    main {
      padding: 22px 0 32px;
    }

    .grid {
      display: grid;
      gap: 16px;
    }

    .metrics {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .layout {
      grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
      align-items: start;
      margin-top: 16px;
    }

    section, .metric {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }

    .metric {
      padding: 14px;
      min-height: 92px;
    }

    .metric strong {
      display: block;
      font-size: 28px;
      line-height: 1;
      margin-top: 10px;
    }

    .metric span, .label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0;
      font-weight: 700;
    }

    section {
      overflow: hidden;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
    }

    h2 {
      margin: 0;
      font-size: 15px;
      line-height: 1.2;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    button, .link-button {
      appearance: none;
      border: 1px solid #b9c2d2;
      background: #fff;
      color: var(--ink);
      border-radius: 6px;
      min-height: 34px;
      padding: 0 11px;
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
    }

    button.primary {
      background: var(--blue);
      border-color: var(--blue);
      color: #fff;
    }

    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }

    .content {
      padding: 14px 16px;
    }

    .services {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }

    .service {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      min-height: 62px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 8px;
    }

    .status {
      font-size: 12px;
      font-weight: 800;
    }

    .ok { color: var(--green); }
    .bad { color: var(--red); }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 13px;
    }

    th, td {
      padding: 10px 8px;
      border-bottom: 1px solid #edf0f5;
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
    }

    td {
      overflow-wrap: anywhere;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 0 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 12px;
      font-weight: 760;
    }

    .pill.high, .pill.critical { background: #fee2e2; color: #991b1b; }
    .pill.medium { background: #fef3c7; color: #92400e; }
    .pill.completed { background: #dcfce7; color: #166534; }
    .pill.failed { background: #fee2e2; color: #991b1b; }

    .side {
      display: grid;
      gap: 16px;
    }

    .links {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .log {
      width: 100%;
      min-height: 220px;
      max-height: 360px;
      overflow: auto;
      border: 1px solid #cfd6e4;
      background: #111827;
      color: #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .search {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }

    input {
      min-height: 36px;
      border: 1px solid #b9c2d2;
      border-radius: 6px;
      padding: 0 10px;
      font: inherit;
      font-size: 13px;
      min-width: 0;
    }

    .results {
      margin-top: 12px;
      display: grid;
      gap: 8px;
    }

    .result {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      font-size: 13px;
    }

    .empty {
      color: var(--muted);
      font-size: 13px;
      padding: 18px 0;
    }

    @media (max-width: 980px) {
      .metrics, .services, .layout {
        grid-template-columns: 1fr;
      }

      .links {
        grid-template-columns: 1fr;
      }

      .topbar {
        align-items: flex-start;
        flex-direction: column;
        padding: 14px 0;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="wrap topbar">
      <div>
        <h1>reduOS Local Dashboard</h1>
        <div class="sub" id="generated">Loading</div>
      </div>
      <div class="toolbar">
        <button id="refresh">Refresh</button>
        <button class="primary" data-demo="full">Run Full Demo</button>
        <button id="logout">Logout</button>
      </div>
    </div>
  </header>

  <main class="wrap">
    <div class="grid metrics">
      <div class="metric"><span>Events</span><strong id="count-events">0</strong></div>
      <div class="metric"><span>Insights</span><strong id="count-insights">0</strong></div>
      <div class="metric"><span>Actions</span><strong id="count-actions">0</strong></div>
      <div class="metric"><span>Feedback</span><strong id="count-feedback">0</strong></div>
      <div class="metric"><span>Memory</span><strong id="count-memory">0</strong></div>
    </div>

    <div class="grid layout">
      <div class="grid">
        <section>
          <div class="section-head">
            <h2>Recent Events</h2>
            <div class="toolbar">
              <button data-event="support">Support</button>
              <button data-event="reliability">Reliability</button>
              <button data-event="product">Product</button>
              <button data-event="growth">Growth</button>
              <button data-event="umami">Umami</button>
              <button data-event="uptime">Uptime Kuma</button>
              <button data-event="listmonk">Listmonk</button>
              <button data-event="glitchtip">GlitchTip</button>
              <button data-event="zammad">Zammad</button>
            </div>
          </div>
          <div class="content">
            <table>
              <thead>
                <tr>
                  <th style="width: 160px;">Created</th>
                  <th style="width: 190px;">Type</th>
                  <th style="width: 110px;">Severity</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody id="events"></tbody>
            </table>
          </div>
        </section>

        <section>
          <div class="section-head">
            <h2>AI Insights</h2>
          </div>
          <div class="content">
            <table>
              <thead>
                <tr>
                  <th style="width: 140px;">Priority</th>
                  <th style="width: 170px;">Category</th>
                  <th>Summary</th>
                  <th style="width: 240px;">Action</th>
                </tr>
              </thead>
              <tbody id="insights"></tbody>
            </table>
          </div>
        </section>

        <section>
          <div class="section-head">
            <h2>Automation And Feedback</h2>
          </div>
          <div class="content">
            <table>
              <thead>
                <tr>
                  <th style="width: 180px;">Action</th>
                  <th style="width: 120px;">Status</th>
                  <th style="width: 150px;">Target</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody id="actions"></tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="side">
        <section>
          <div class="section-head"><h2>Services</h2></div>
          <div class="content services" id="services"></div>
        </section>

        <section>
          <div class="section-head"><h2>Links</h2></div>
          <div class="content links" id="links"></div>
        </section>

        <section>
          <div class="section-head">
            <h2>Memory Search</h2>
          </div>
          <div class="content">
            <div class="search">
              <input id="memory-query" value="customers blocked during onboarding" />
              <button id="memory-search">Search</button>
            </div>
            <div class="results" id="memory-results"></div>
          </div>
        </section>

        <section>
          <div class="section-head">
            <h2>Run Output</h2>
            <button data-demo="onboarding">Onboarding Demo</button>
          </div>
          <div class="content">
            <div class="log" id="log">Ready.</div>
          </div>
        </section>
      </div>
    </div>
  </main>

  <script>
    const state = { loading: false };

    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));

    function fmtDate(value) {
      if (!value) return "";
      return new Date(value).toLocaleString();
    }

    function pill(value) {
      const normalized = String(value ?? "").toLowerCase();
      return '<span class="pill ' + esc(normalized) + '">' + esc(value ?? "unknown") + '</span>';
    }

    function truncate(value, max = 180) {
      const text = String(value ?? "");
      return text.length > max ? text.slice(0, max - 1) + "..." : text;
    }

    async function api(path, options) {
      const response = await fetch(path, options);
      const body = await response.json();
      if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Authentication required");
      }
      if (!response.ok || body.ok === false) {
        throw new Error(body.error || "Request failed");
      }
      return body;
    }

    async function refresh() {
      const data = await api("/api/summary");
      $("generated").textContent = "Updated " + fmtDate(data.generated_at);
      $("count-events").textContent = data.counts.events ?? 0;
      $("count-insights").textContent = data.counts.insights ?? 0;
      $("count-actions").textContent = data.counts.actions ?? 0;
      $("count-feedback").textContent = data.counts.feedback ?? 0;
      $("count-memory").textContent = data.counts.memory ?? "n/a";

      $("events").innerHTML = data.events.map((event) =>
        '<tr>' +
          '<td>' + esc(fmtDate(event.created_at)) + '</td>' +
          '<td>' + esc(event.type) + '</td>' +
          '<td>' + pill(event.severity) + '</td>' +
          '<td>' + esc(truncate(event.message, 220)) + '</td>' +
        '</tr>'
      ).join("") || '<tr><td colspan="4" class="empty">No events yet.</td></tr>';

      $("insights").innerHTML = data.insights.map((insight) =>
        '<tr>' +
          '<td>' + pill(insight.priority) + '</td>' +
          '<td>' + esc(insight.category) + '</td>' +
          '<td>' + esc(truncate(insight.summary, 220)) + '</td>' +
          '<td>' + esc(truncate(insight.recommended_action, 180)) + '</td>' +
        '</tr>'
      ).join("") || '<tr><td colspan="4" class="empty">No insights yet.</td></tr>';

      $("actions").innerHTML = data.actions.map((action) =>
        '<tr>' +
          '<td>' + esc(action.action_type) + '</td>' +
          '<td>' + pill(action.status) + '</td>' +
          '<td>' + esc(action.target || "") + '</td>' +
          '<td>' + esc(truncate(JSON.stringify(action.result || {}), 220)) + '</td>' +
        '</tr>'
      ).join("") || '<tr><td colspan="4" class="empty">No actions yet.</td></tr>';

      $("services").innerHTML = Object.entries(data.services).map(([name, ok]) =>
        '<div class="service">' +
          '<div class="label">' + esc(name) + '</div>' +
          '<div class="status ' + (ok ? "ok" : "bad") + '">' + (ok ? "OK" : "DOWN") + '</div>' +
        '</div>'
      ).join("");

      $("links").innerHTML = Object.entries(data.links).map(([name, url]) =>
        '<a class="link-button" href="' + esc(url) + '" target="_blank" rel="noreferrer">' +
          esc(name.replaceAll("_", " ")) +
        '</a>'
      ).join("");
    }

    async function runEvent(kind, button) {
      button.disabled = true;
      $("log").textContent = "Sending " + kind + " event...";
      try {
        const body = await api("/api/event/" + kind, { method: "POST" });
        $("log").textContent = JSON.stringify(body, null, 2);
        await refresh();
      } catch (error) {
        $("log").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    }

    async function runDemo(kind, button) {
      button.disabled = true;
      $("log").textContent = "Running " + kind + " demo...";
      try {
        const body = await api("/api/demo/" + kind, { method: "POST" });
        $("log").textContent = [body.stdout, body.stderr].filter(Boolean).join("\\n");
        await refresh();
      } catch (error) {
        $("log").textContent = error.message;
      } finally {
        button.disabled = false;
      }
    }

    async function searchMemory() {
      $("memory-results").innerHTML = '<div class="empty">Searching...</div>';
      try {
        const body = await api("/api/memory/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: $("memory-query").value, limit: 5 })
        });
        $("memory-results").innerHTML = (body.items || []).map((item) =>
          '<div class="result">' +
            '<div class="label">score ' + (Number(item.score || 0) * 100).toFixed(0) + '%</div>' +
            '<strong>' + esc(item.event?.type || "event") + '</strong>' +
            '<div>' + esc(truncate(item.event?.message, 220)) + '</div>' +
          '</div>'
        ).join("") || '<div class="empty">No matches.</div>';
      } catch (error) {
        $("memory-results").innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
      }
    }

    document.querySelectorAll("[data-event]").forEach((button) => {
      button.addEventListener("click", () => runEvent(button.dataset.event, button));
    });

    document.querySelectorAll("[data-demo]").forEach((button) => {
      button.addEventListener("click", () => runDemo(button.dataset.demo, button));
    });

    $("refresh").addEventListener("click", refresh);
    $("logout").addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    });
    $("memory-search").addEventListener("click", searchMemory);
    $("memory-query").addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchMemory();
    });

    refresh().catch((error) => {
      $("log").textContent = error.message;
    });
  </script>
</body>
</html>`;

await app.listen({ host: "0.0.0.0", port });
console.log(`reduOS dashboard listening on http://127.0.0.1:${port}`);
