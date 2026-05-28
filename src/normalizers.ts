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

function firstRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return asRecord(value[0]);
  return asRecord(value);
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

function topAppFrame(exception: Record<string, unknown>): Record<string, unknown> | null {
  const stacktrace = asRecord(exception.stacktrace);
  const frames = Array.isArray(stacktrace.frames) ? stacktrace.frames.map(asRecord) : [];
  const appFrames = frames.filter(f => {
    const fn = asString(f.filename) ?? asString(f.abs_path) ?? "";
    return fn && !fn.includes("node_modules") && !fn.startsWith("internal/") && !fn.startsWith("node:");
  });
  return appFrames[appFrames.length - 1] ?? frames[frames.length - 1] ?? null;
}

function extractGlitchTipIssueId(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/issues\/(\d+)\//);
  return m?.[1] ?? null;
}

export function normalizeGlitchTip(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);

  // Slack-compatible webhook format sent by GlitchTip's alert system
  // Detected by presence of `attachments` array without a Sentry `event` envelope
  if (Array.isArray(p.attachments) && !p.event) {
    const att = asRecord(p.attachments[0]);
    const titleLink = asString(att.title_link);
    const issueId = extractGlitchTipIssueId(titleLink);
    const title = asString(att.title) ?? asString(p.text) ?? "GlitchTip alert";
    const culprit = asString(att.text);
    const fields = Array.isArray(att.fields) ? att.fields.map(asRecord) : [];
    const projectField = fields.find(f => asString(f.title)?.toLowerCase() === "project");
    const project = asString(projectField?.value) ?? "unknown-project";
    // Split "ExceptionType: message" title into type + value
    const colonIdx = title.indexOf(": ");
    const exceptionType  = colonIdx > 0 ? title.slice(0, colonIdx) : null;
    const exceptionValue = colonIdx > 0 ? title.slice(colonIdx + 2) : title;

    return {
      type: "error.created",
      source: "glitchtip",
      severity: "high",
      user_email: null,
      user_name: null,
      message: truncate(title),
      metadata: {
        project,
        level: "error",
        exception_type: exceptionType,
        exception_value: exceptionValue,
        stack_top: null,
        transaction: culprit,
        url: null,
        method: null,
        culprit,
        glitchtip_issue_id: issueId,
        event_id: issueId ? `issue-${issueId}` : null,
        release: null,
        environment: null,
        platform: null,
        tags: null,
        fingerprint: null,
        raw: p
      }
    };
  }

  const event = asRecord(p.event);
  const projectPayload = asRecord(p.project);
  const user = {
    ...asRecord(event.user),
    ...asRecord(p.user)
  };
  const request = {
    ...asRecord(event.request),
    ...asRecord(p.request)
  };
  const exception = firstRecord(asRecord(event.exception).values ?? asRecord(p.exception).values);

  const level = p.level ?? event.level;
  const project =
    asString(p.project_name) ??
    asString(projectPayload.name) ??
    asString(projectPayload.slug) ??
    asString(p.project) ??
    asString(event.project) ??
    "unknown-project";
  const exceptionText = [asString(exception.type), asString(exception.value)]
    .filter(Boolean)
    .join(": ");
  const transaction =
    asString(event.transaction) ??
    asString(p.transaction) ??
    asString(event.culprit) ??
    asString(p.culprit);
  const message =
    exceptionText ||
    asString(p.message) ||
    asString(event.message) ||
    asString(event.title) ||
    transaction ||
    "GlitchTip event received";

  const top = topAppFrame(exception);
  const stackTop = top ? {
    file: asString(top.filename) ?? asString(top.abs_path),
    line: top.lineno,
    fn:   asString(top.function),
    context: asString(top.context_line),
  } : null;

  // Some Sentry-protocol payloads include the GlitchTip issue URL in tags or links
  const issueUrl = asString(p.issue_url) ?? asString(event.issue_url);
  const glitchtipIssueId = extractGlitchTipIssueId(issueUrl);

  return {
    type: "error.created",
    source: "glitchtip",
    severity: severityFrom(level, "high"),
    user_email: asString(user.email) ?? null,
    user_name: asString(user.name) ?? asString(user.username) ?? null,
    message: truncate(message),
    metadata: {
      project,
      level,
      exception_type: exception.type,
      exception_value: exception.value,
      stack_top: stackTop,
      glitchtip_issue_id: glitchtipIssueId,
      transaction,
      url: request.url,
      method: request.method,
      culprit: p.culprit ?? event.culprit,
      event_id: p.event_id ?? event.event_id ?? event.id,
      release: p.release ?? event.release,
      environment: p.environment ?? event.environment,
      platform: p.platform ?? event.platform,
      tags: p.tags ?? event.tags,
      fingerprint: p.fingerprint ?? event.fingerprint,
      raw: p
    }
  };
}

export function normalizeZammad(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);
  const ticket = asRecord(p.ticket);
  // Webhook payload nests customer under ticket.customer; direct posts may use top-level
  const customer = {
    ...asRecord(ticket.customer),
    ...asRecord(p.customer),
  };
  const article = asRecord(p.article);

  const title = asString(ticket.title) ?? asString(p.title) ?? "Support ticket";
  const body = asString(article.body) ?? asString(p.message) ?? "";
  const priority = ticket.priority ?? p.priority ?? ticket.priority_id;
  const state = asString(ticket.state) ?? asString(p.state_name) ?? "";
  const isResolved = ["closed", "merged", "solved"].includes(state.toLowerCase());

  const userEmail = asString(customer.email) ?? asString(p.customer_email) ?? asString(p.email) ?? null;
  const userName = asString(customer.firstname)
    ? [asString(customer.firstname), asString(customer.lastname)].filter(Boolean).join(" ")
    : asString(customer.name) ?? asString(p.customer_name) ?? asString(p.name) ?? null;

  return {
    type: isResolved ? "support.ticket.resolved" : "support.ticket.created",
    source: "zammad",
    severity: severityFrom(priority, "medium"),
    user_email: userEmail,
    user_name: userName || null,
    message: truncate(body ? `${title}\n\n${body}` : title),
    metadata: {
      ticket_id: ticket.id ?? p.ticket_id,
      ticket_title: title,
      ticket_state: state || ticket.state,
      article_id: article.id,
      priority,
      raw: p
    }
  };
}

export function normalizeUptimeKuma(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);
  const heartbeat = asRecord(p.heartbeat);
  const monitor = asRecord(p.monitor);

  const status = heartbeat.status ?? p.status;
  const statusText = asString(heartbeat.statusText) ?? asString(p.statusText);
  const isDown =
    status === 0 ||
    status === "0" ||
    String(status ?? statusText ?? "").toLowerCase() === "down";
  const monitorName =
    asString(monitor.name) ??
    asString(p.monitor_name) ??
    asString(p.name) ??
    "Monitor";
  const monitorUrl =
    asString(monitor.url) ??
    asString(p.monitor_url) ??
    asString(p.url);
  const message =
    asString(heartbeat.msg) ??
    asString(p.msg) ??
    asString(p.message) ??
    statusText ??
    (isDown ? "down" : "recovered");

  return {
    type: isDown ? "uptime.monitor.down" : "uptime.monitor.recovered",
    source: "uptime-kuma",
    severity: isDown ? "critical" : "info",
    user_email: null,
    user_name: null,
    message: truncate(`${monitorName}: ${message}`),
    metadata: {
      monitor_name: monitorName,
      monitor_url: monitorUrl,
      status,
      status_text: statusText,
      time: heartbeat.time ?? p.time,
      raw: p
    }
  };
}

export function normalizeUmami(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);
  const eventPayload = asRecord(p.payload);
  const data = {
    ...asRecord(eventPayload.data),
    ...asRecord(p.data)
  };
  const eventName =
    asString(p.event_name) ??
    asString(eventPayload.name) ??
    asString(p.name);
  const url =
    asString(p.url) ??
    asString(eventPayload.url);

  return {
    type: "analytics.event",
    source: "umami",
    severity: "info",
    user_email: asString(p.email) ?? asString(data.email) ?? null,
    user_name: asString(p.user_name) ?? asString(data.name) ?? null,
    message: truncate(
      eventName ??
      url ??
      "Umami event received"
    ),
    metadata: {
      hostname: p.hostname ?? eventPayload.hostname,
      website: p.website ?? eventPayload.website,
      url,
      title: p.title ?? eventPayload.title,
      referrer: p.referrer ?? eventPayload.referrer,
      event_name: eventName,
      data,
      raw: p
    }
  };
}

export function normalizeListmonk(payload: unknown): NormalizedEvent {
  const p = asRecord(payload);
  const subscriber = asRecord(p.subscriber);
  const list = asRecord(p.list);

  const email =
    asString(p.email) ??
    asString(subscriber.email) ??
    asString(asRecord(p.data).email);
  const name =
    asString(p.name) ??
    asString(subscriber.name) ??
    asString(asRecord(p.data).name);
  const company =
    asString(p.company) ??
    asString(asRecord(subscriber.attribs).company) ??
    asString(asRecord(p.attribs).company);
  const signupSource =
    asString(p.source) ??
    asString(asRecord(subscriber.attribs).source) ??
    asString(p.referrer) ??
    "listmonk";
  const listName =
    asString(p.list_name) ??
    asString(list.name) ??
    asString(asRecord(p.list).list_name) ??
    "waitlist";
  const eventName =
    asString(p.event) ??
    asString(p.type) ??
    "subscriber.created";

  const companyText = company ? ` from ${company}` : "";
  const sourceText = signupSource ? ` via ${signupSource}` : "";

  return {
    type: eventName.includes("unsubscribe") ? "audience.subscriber.unsubscribed" : "audience.subscriber.created",
    source: "listmonk",
    severity: eventName.includes("unsubscribe") ? "medium" : "info",
    user_email: email ?? null,
    user_name: name ?? null,
    message: truncate(
      email
        ? `${name ?? "A new contact"}${companyText} joined ${listName}${sourceText}. Email: ${email}`
        : `Listmonk ${eventName} event for ${listName}`
    ),
    metadata: {
      list_name: listName,
      list_uuid: p.list_uuid ?? list.uuid,
      subscriber_id: p.subscriber_id ?? subscriber.id,
      subscriber_uuid: p.subscriber_uuid ?? subscriber.uuid,
      company,
      signup_source: signupSource,
      event: eventName,
      raw: p
    }
  };
}
