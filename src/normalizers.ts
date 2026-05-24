import { config } from "./config.js";
import type { NormalizedEvent, Severity } from "./types.js";
import { genericEventSchema } from "./validation.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function truncate(message: string): string {
  if (message.length <= config.MAX_EVENT_MESSAGE_LENGTH) return message;
  return message.slice(0, config.MAX_EVENT_MESSAGE_LENGTH) + "...[truncated]";
}

function severityFrom(value: unknown, fallback: Severity = "info"): Severity {
  const raw = String(value ?? "").toLowerCase();

  if (["fatal", "critical", "panic"].includes(raw)) return "critical";
  if (["error", "high", "down"].includes(raw)) return "high";
  if (["warning", "warn", "medium"].includes(raw)) return "medium";
  if (["low"].includes(raw)) return "low";
  if (["debug"].includes(raw)) return "debug";
  if (["info", "ok", "up", "resolved"].includes(raw)) return "info";

  return fallback;
}

export function normalizeGeneric(payload: unknown): NormalizedEvent {
  const parsed = genericEventSchema.parse(payload);

  return {
    type: parsed.type,
    source: parsed.source,
    severity: parsed.severity,
    user_email: parsed.user?.email ?? null,
    user_name: parsed.user?.name ?? null,
    message: truncate(parsed.message),
    metadata: parsed.metadata
  };
}

export function normalizeGlitchTip(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);
  const event = asRecord(p.event);

  const level = p.level ?? event.level;
  const project = asString(p.project) ?? asString(event.project) ?? "unknown-project";
  const message =
    asString(p.message) ??
    asString(event.message) ??
    asString(event.title) ??
    asString(p.culprit) ??
    "GlitchTip event received";

  return {
    type: "error.created",
    source: "glitchtip",
    severity: severityFrom(level, "high"),
    user_email: asString(asRecord(p.user).email) ?? null,
    user_name: asString(asRecord(p.user).name) ?? null,
    message: truncate(message),
    metadata: {
      project,
      level,
      culprit: p.culprit ?? event.culprit,
      event_id: p.event_id ?? event.event_id,
      release: event.release,
      environment: event.environment,
      raw: p
    }
  };
}

export function normalizeZammad(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);
  const ticket = asRecord(p.ticket);
  const customer = asRecord(p.customer);
  const article = asRecord(p.article);

  const title = asString(ticket.title) ?? "Support ticket";
  const body = asString(article.body) ?? asString(p.message) ?? "";
  const priority = ticket.priority ?? ticket.priority_id;

  return {
    type: "support.ticket.created",
    source: "zammad",
    severity: severityFrom(priority, "medium"),
    user_email: asString(customer.email) ?? asString(p.customer_email) ?? null,
    user_name: asString(customer.name) ?? asString(p.customer_name) ?? null,
    message: truncate(body ? `${title}\n\n${body}` : title),
    metadata: {
      ticket_id: ticket.id ?? p.ticket_id,
      ticket_title: title,
      ticket_state: ticket.state,
      priority,
      raw: p
    }
  };
}

export function normalizeUptimeKuma(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);
  const heartbeat = asRecord(p.heartbeat);
  const monitor = asRecord(p.monitor);

  const status = heartbeat.status;
  const isDown = status === 0 || status === "0" || status === "down";

  return {
    type: isDown ? "uptime.monitor.down" : "uptime.monitor.recovered",
    source: "uptime-kuma",
    severity: isDown ? "critical" : "info",
    user_email: null,
    user_name: null,
    message: truncate(
      `${asString(monitor.name) ?? "Monitor"}: ${asString(heartbeat.msg) ?? (isDown ? "down" : "recovered")}`
    ),
    metadata: {
      monitor_name: monitor.name,
      monitor_url: monitor.url,
      status,
      time: heartbeat.time,
      raw: p
    }
  };
}

export function normalizeUmami(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);

  return {
    type: "analytics.event",
    source: "umami",
    severity: "info",
    user_email: asString(p.email) ?? null,
    user_name: asString(p.name) ?? null,
    message: truncate(
      asString(p.event_name) ??
      asString(p.name) ??
      asString(p.url) ??
      "Umami event received"
    ),
    metadata: {
      hostname: p.hostname,
      url: p.url,
      referrer: p.referrer,
      event_name: p.event_name ?? p.name,
      raw: p
    }
  };
}
