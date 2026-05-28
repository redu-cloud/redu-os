import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Set required env vars before config module loads
process.env.COLLECTOR_API_KEY      ??= "test-key-12345";
process.env.SUPABASE_URL           ??= "http://localhost:8000";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key-00000000000000";
process.env.MAX_EVENT_MESSAGE_LENGTH  ??= "8000";

const { normalizeGlitchTip, normalizeZammad, normalizeUptimeKuma, normalizeUmami, normalizeListmonk } =
  await import("./normalizers.js");

// ─────────────────────────────────────────────────────────────────────────────
// normalizeGlitchTip
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeGlitchTip — Slack webhook format", () => {
  const slackBase = {
    text: "New alert",
    attachments: [
      {
        title: "TypeError: Cannot read properties of null",
        title_link: "http://glitchtip.example.com/organizations/reduos/issues/42/",
        text: "src/handler.ts in processUser",
        fields: [{ title: "Project", value: "AI-OS-Demo" }],
      },
    ],
  };

  test("produces error.created from glitchtip", () => {
    const out = normalizeGlitchTip(slackBase);
    assert.equal(out.type, "error.created");
    assert.equal(out.source, "glitchtip");
  });

  test("extracts issue ID from title_link", () => {
    const out = normalizeGlitchTip(slackBase);
    assert.equal((out.metadata as Record<string, unknown>).glitchtip_issue_id, "42");
  });

  test("extracts project from fields", () => {
    const out = normalizeGlitchTip(slackBase);
    assert.equal((out.metadata as Record<string, unknown>).project, "AI-OS-Demo");
  });

  test("splits title into exceptionType and exceptionValue on first colon", () => {
    const out = normalizeGlitchTip(slackBase);
    const meta = out.metadata as Record<string, unknown>;
    assert.equal(meta.exception_type, "TypeError");
    assert.equal(meta.exception_value, "Cannot read properties of null");
  });

  test("title without colon: exceptionType is null, message is full title", () => {
    const payload = {
      attachments: [{ title: "Application crashed", title_link: undefined, text: "", fields: [] }],
    };
    const out = normalizeGlitchTip(payload);
    const meta = out.metadata as Record<string, unknown>;
    assert.equal(meta.exception_type, null);
    assert.equal(meta.exception_value, "Application crashed");
    assert.equal(out.message, "Application crashed");
  });

  test("no title_link → glitchtip_issue_id is null", () => {
    const payload = {
      attachments: [{ title: "Error: boom", title_link: undefined, text: "", fields: [] }],
    };
    const out = normalizeGlitchTip(payload);
    assert.equal((out.metadata as Record<string, unknown>).glitchtip_issue_id, null);
  });

  test("missing project field → unknown-project", () => {
    const payload = {
      attachments: [{ title: "Error: x", title_link: undefined, text: "", fields: [] }],
    };
    const out = normalizeGlitchTip(payload);
    assert.equal((out.metadata as Record<string, unknown>).project, "unknown-project");
  });

  test("severity is always high for Slack-format alerts", () => {
    const out = normalizeGlitchTip(slackBase);
    assert.equal(out.severity, "high");
  });

  test("culprit is set from attachment text", () => {
    const out = normalizeGlitchTip(slackBase);
    const meta = out.metadata as Record<string, unknown>;
    assert.equal(meta.culprit, "src/handler.ts in processUser");
  });
});

describe("normalizeGlitchTip — Sentry envelope format", () => {
  const sentryBase = {
    event: {
      level: "error",
      exception: {
        values: [
          {
            type: "ReferenceError",
            value: "session is not defined",
            stacktrace: {
              frames: [
                { filename: "node_modules/express/lib/router.js", lineno: 100, function: "handle" },
                { filename: "src/auth/session.ts", lineno: 47, function: "validateSession", context_line: "  if (session.user === null)" },
              ],
            },
          },
        ],
      },
      user: { email: "alice@example.com", name: "Alice" },
      request: { url: "https://app.example.com/api/login", method: "POST" },
      environment: "production",
      release: "1.2.3",
    },
    project_name: "my-app",
  };

  test("produces error.created", () => {
    const out = normalizeGlitchTip(sentryBase);
    assert.equal(out.type, "error.created");
    assert.equal(out.source, "glitchtip");
  });

  test("extracts user email and name", () => {
    const out = normalizeGlitchTip(sentryBase);
    assert.equal(out.user_email, "alice@example.com");
    assert.equal(out.user_name, "Alice");
  });

  test("builds message from exception type and value", () => {
    const out = normalizeGlitchTip(sentryBase);
    assert.equal(out.message, "ReferenceError: session is not defined");
  });

  test("extracts stack_top — skips node_modules, takes last app frame", () => {
    const out = normalizeGlitchTip(sentryBase);
    const meta = out.metadata as Record<string, unknown>;
    const stackTop = meta.stack_top as Record<string, unknown>;
    assert.ok(stackTop, "stack_top should not be null");
    assert.equal(stackTop.file, "src/auth/session.ts");
    assert.equal(stackTop.line, 47);
    assert.equal(stackTop.fn, "validateSession");
    assert.equal(stackTop.context, "if (session.user === null)");
  });

  test("extracts request URL and method", () => {
    const out = normalizeGlitchTip(sentryBase);
    const meta = out.metadata as Record<string, unknown>;
    assert.equal(meta.url, "https://app.example.com/api/login");
    assert.equal(meta.method, "POST");
  });

  test("extracts project name", () => {
    const out = normalizeGlitchTip(sentryBase);
    assert.equal((out.metadata as Record<string, unknown>).project, "my-app");
  });

  test("level 'fatal' → severity 'critical'", () => {
    const out = normalizeGlitchTip({ event: { level: "fatal", exception: { values: [{}] } } });
    assert.equal(out.severity, "critical");
  });

  test("level 'error' → severity 'high'", () => {
    const out = normalizeGlitchTip(sentryBase);
    assert.equal(out.severity, "high");
  });

  test("level 'warning' → severity 'medium'", () => {
    const out = normalizeGlitchTip({ event: { level: "warning", exception: { values: [{}] } } });
    assert.equal(out.severity, "medium");
  });

  test("no exception → falls back to event.message", () => {
    const out = normalizeGlitchTip({ event: { message: "Something broke", level: "error" } });
    assert.equal(out.message, "Something broke");
  });

  test("no exception, no message → falls back to 'GlitchTip event received'", () => {
    const out = normalizeGlitchTip({ event: {} });
    assert.equal(out.message, "GlitchTip event received");
  });

  test("stack with only node_modules frames → takes last frame anyway", () => {
    const out = normalizeGlitchTip({
      event: {
        level: "error",
        exception: {
          values: [{
            type: "Error",
            value: "oops",
            stacktrace: {
              frames: [
                { filename: "node_modules/foo/bar.js", lineno: 1, function: "fn" },
                { filename: "node_modules/baz/qux.js", lineno: 2, function: "fn2" },
              ],
            },
          }],
        },
      },
    });
    const stackTop = (out.metadata as Record<string, unknown>).stack_top as Record<string, unknown>;
    assert.ok(stackTop, "should fall back to last frame");
    assert.equal(stackTop.file, "node_modules/baz/qux.js");
  });

  test("internal/ frames excluded from app frames", () => {
    const out = normalizeGlitchTip({
      event: {
        level: "error",
        exception: {
          values: [{
            type: "Error",
            value: "net fail",
            stacktrace: {
              frames: [
                { filename: "internal/net.js", lineno: 10, function: "connect" },
                { filename: "src/app.ts", lineno: 20, function: "start" },
              ],
            },
          }],
        },
      },
    });
    const stackTop = (out.metadata as Record<string, unknown>).stack_top as Record<string, unknown>;
    assert.equal(stackTop.file, "src/app.ts");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeZammad
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeZammad", () => {
  const createdBase = {
    ticket: {
      id: 17,
      title: "Cannot log in",
      state: "open",
      priority: "2 normal",
      customer: {
        email: "bob@example.com",
        firstname: "Bob",
        lastname: "Smith",
      },
    },
    article: { id: 5, body: "I keep getting an error when I try to log in." },
  };

  test("state 'open' → support.ticket.created", () => {
    const out = normalizeZammad(createdBase);
    assert.equal(out.type, "support.ticket.created");
    assert.equal(out.source, "zammad");
  });

  test("state 'closed' → support.ticket.resolved", () => {
    const out = normalizeZammad({ ...createdBase, ticket: { ...createdBase.ticket, state: "closed" } });
    assert.equal(out.type, "support.ticket.resolved");
  });

  test("state 'solved' → support.ticket.resolved", () => {
    const out = normalizeZammad({ ...createdBase, ticket: { ...createdBase.ticket, state: "solved" } });
    assert.equal(out.type, "support.ticket.resolved");
  });

  test("state 'merged' → support.ticket.resolved", () => {
    const out = normalizeZammad({ ...createdBase, ticket: { ...createdBase.ticket, state: "merged" } });
    assert.equal(out.type, "support.ticket.resolved");
  });

  test("state is case-insensitive ('Closed' → resolved)", () => {
    const out = normalizeZammad({ ...createdBase, ticket: { ...createdBase.ticket, state: "Closed" } });
    assert.equal(out.type, "support.ticket.resolved");
  });

  test("extracts customer email from ticket.customer", () => {
    const out = normalizeZammad(createdBase);
    assert.equal(out.user_email, "bob@example.com");
  });

  test("joins firstname + lastname into user_name", () => {
    const out = normalizeZammad(createdBase);
    assert.equal(out.user_name, "Bob Smith");
  });

  test("customer at top level (not nested in ticket)", () => {
    const out = normalizeZammad({
      ticket: { id: 1, title: "Test", state: "open" },
      customer: { email: "top@example.com", name: "Top User" },
    });
    assert.equal(out.user_email, "top@example.com");
  });

  test("message includes title and article body", () => {
    const out = normalizeZammad(createdBase);
    assert.ok(out.message.includes("Cannot log in"));
    assert.ok(out.message.includes("I keep getting an error"));
  });

  test("no article body → message is just title", () => {
    const out = normalizeZammad({ ...createdBase, article: {} });
    assert.equal(out.message, "Cannot log in");
  });

  test("ticket_id stored in metadata", () => {
    const out = normalizeZammad(createdBase);
    assert.equal((out.metadata as Record<string, unknown>).ticket_id, 17);
  });

  test("missing everything → graceful fallback", () => {
    const out = normalizeZammad({});
    assert.equal(out.type, "support.ticket.created");
    assert.equal(out.source, "zammad");
    assert.equal(out.message, "Support ticket");
  });

  test("top-level customer_email fallback", () => {
    const out = normalizeZammad({
      ticket: { state: "open" },
      customer_email: "fallback@example.com",
    });
    assert.equal(out.user_email, "fallback@example.com");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeUptimeKuma
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeUptimeKuma", () => {
  const downBase = {
    heartbeat: { status: 0, msg: "Connection refused", time: "2026-01-01T00:00:00Z" },
    monitor: { name: "API Server", url: "https://api.example.com/health" },
  };
  const upBase = {
    heartbeat: { status: 1, msg: "OK", time: "2026-01-01T00:05:00Z" },
    monitor: { name: "API Server", url: "https://api.example.com/health" },
  };

  test("status 0 → uptime.monitor.down", () => {
    const out = normalizeUptimeKuma(downBase);
    assert.equal(out.type, "uptime.monitor.down");
    assert.equal(out.severity, "critical");
  });

  test("status '0' (string) → uptime.monitor.down", () => {
    const out = normalizeUptimeKuma({ heartbeat: { status: "0", msg: "down" }, monitor: { name: "X" } });
    assert.equal(out.type, "uptime.monitor.down");
  });

  test("status 1 → uptime.monitor.recovered", () => {
    const out = normalizeUptimeKuma(upBase);
    assert.equal(out.type, "uptime.monitor.recovered");
    assert.equal(out.severity, "info");
  });

  test("status '1' (string) → uptime.monitor.recovered", () => {
    const out = normalizeUptimeKuma({ heartbeat: { status: "1" }, monitor: { name: "X" } });
    assert.equal(out.type, "uptime.monitor.recovered");
  });

  test("message includes monitor name and heartbeat message", () => {
    const out = normalizeUptimeKuma(downBase);
    assert.ok(out.message.includes("API Server"));
    assert.ok(out.message.includes("Connection refused"));
  });

  test("monitor name from monitor.name", () => {
    const out = normalizeUptimeKuma(downBase);
    assert.equal((out.metadata as Record<string, unknown>).monitor_name, "API Server");
  });

  test("monitor name from p.monitor_name fallback", () => {
    const out = normalizeUptimeKuma({ heartbeat: { status: 0 }, monitor_name: "DB" });
    assert.equal((out.metadata as Record<string, unknown>).monitor_name, "DB");
  });

  test("monitor name fallback to 'Monitor'", () => {
    const out = normalizeUptimeKuma({ heartbeat: { status: 0 } });
    assert.equal((out.metadata as Record<string, unknown>).monitor_name, "Monitor");
  });

  test("monitor url stored in metadata", () => {
    const out = normalizeUptimeKuma(downBase);
    assert.equal((out.metadata as Record<string, unknown>).monitor_url, "https://api.example.com/health");
  });

  test("no heartbeat → reads p.status directly", () => {
    const out = normalizeUptimeKuma({ status: 0, monitor: { name: "X" } });
    assert.equal(out.type, "uptime.monitor.down");
  });

  test("source is always uptime-kuma", () => {
    const out = normalizeUptimeKuma(downBase);
    assert.equal(out.source, "uptime-kuma");
  });

  test("user fields are always null", () => {
    const out = normalizeUptimeKuma(downBase);
    assert.equal(out.user_email, null);
    assert.equal(out.user_name, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeUmami
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeUmami", () => {
  test("extracts event_name as message", () => {
    const out = normalizeUmami({ event_name: "signup", url: "/register" });
    assert.equal(out.type, "analytics.event");
    assert.equal(out.message, "signup");
  });

  test("nested payload: extracts name from payload.name", () => {
    const out = normalizeUmami({
      payload: { name: "button_click", url: "/pricing", website: "abc-123" },
    });
    assert.equal(out.message, "button_click");
  });

  test("falls back to URL if no event name", () => {
    const out = normalizeUmami({ url: "/about" });
    assert.equal(out.message, "/about");
  });

  test("falls back to 'Umami event received'", () => {
    const out = normalizeUmami({});
    assert.equal(out.message, "Umami event received");
  });

  test("source is always umami, severity always info", () => {
    const out = normalizeUmami({ event_name: "x" });
    assert.equal(out.source, "umami");
    assert.equal(out.severity, "info");
  });

  test("user email from data.email", () => {
    const out = normalizeUmami({ event_name: "login", data: { email: "u@example.com" } });
    assert.equal(out.user_email, "u@example.com");
  });

  test("user email from payload.data.email", () => {
    const out = normalizeUmami({
      payload: { name: "login", data: { email: "nested@example.com" } },
    });
    assert.equal(out.user_email, "nested@example.com");
  });

  test("metadata includes hostname and website", () => {
    const out = normalizeUmami({
      hostname: "app.example.com",
      website: "site-123",
      event_name: "x",
    });
    const meta = out.metadata as Record<string, unknown>;
    assert.equal(meta.hostname, "app.example.com");
    assert.equal(meta.website, "site-123");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeListmonk
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeListmonk", () => {
  test("basic subscribe: top-level email", () => {
    const out = normalizeListmonk({
      email: "new@example.com",
      name: "Alice",
      list_name: "Beta-Users",
      event: "subscriber.created",
    });
    assert.equal(out.type, "audience.subscriber.created");
    assert.equal(out.source, "listmonk");
    assert.equal(out.severity, "info");
    assert.equal(out.user_email, "new@example.com");
    assert.equal(out.user_name, "Alice");
  });

  test("message includes email and list name", () => {
    const out = normalizeListmonk({
      email: "new@example.com",
      name: "Alice",
      list_name: "Beta-Users",
      event: "subscriber.created",
    });
    assert.ok(out.message.includes("new@example.com"));
    assert.ok(out.message.includes("Beta-Users"));
  });

  test("subscriber nested in subscriber object", () => {
    const out = normalizeListmonk({
      subscriber: { email: "nested@example.com", name: "Bob" },
      list: { name: "Waitlist" },
    });
    assert.equal(out.user_email, "nested@example.com");
    assert.equal(out.user_name, "Bob");
    assert.equal((out.metadata as Record<string, unknown>).list_name, "Waitlist");
  });

  test("event containing 'unsubscribe' → audience.subscriber.unsubscribed, medium severity", () => {
    const out = normalizeListmonk({
      email: "leaving@example.com",
      list_name: "Beta-Users",
      event: "subscriber.unsubscribed",
    });
    assert.equal(out.type, "audience.subscriber.unsubscribed");
    assert.equal(out.severity, "medium");
  });

  test("type field also triggers unsubscribe detection", () => {
    const out = normalizeListmonk({
      email: "x@x.com",
      type: "subscriber.unsubscribed",
    });
    assert.equal(out.type, "audience.subscriber.unsubscribed");
  });

  test("company included in message", () => {
    const out = normalizeListmonk({
      email: "ceo@corp.com",
      name: "Jane",
      company: "CorpCo",
      list_name: "Beta-Users",
      event: "subscriber.created",
    });
    assert.ok(out.message.includes("CorpCo"));
    assert.equal((out.metadata as Record<string, unknown>).company, "CorpCo");
  });

  test("company from subscriber.attribs.company", () => {
    const out = normalizeListmonk({
      subscriber: {
        email: "x@x.com",
        attribs: { company: "NestCo" },
      },
      event: "subscriber.created",
    });
    assert.equal((out.metadata as Record<string, unknown>).company, "NestCo");
  });

  test("list_uuid from top-level and nested list", () => {
    const out = normalizeListmonk({
      email: "x@x.com",
      list_uuid: "uuid-abc",
      event: "subscriber.created",
    });
    assert.equal((out.metadata as Record<string, unknown>).list_uuid, "uuid-abc");
  });

  test("fallback list name to 'waitlist'", () => {
    const out = normalizeListmonk({ email: "x@x.com" });
    assert.equal((out.metadata as Record<string, unknown>).list_name, "waitlist");
  });

  test("no email → graceful fallback message", () => {
    const out = normalizeListmonk({ list_name: "Beta", event: "subscriber.created" });
    assert.ok(out.message.startsWith("Listmonk"));
    assert.equal(out.user_email, null);
  });
});
