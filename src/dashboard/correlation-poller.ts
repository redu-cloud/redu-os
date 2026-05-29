import { langgraphUrl, langgraphApiKey, supabase, collectorUrl, collectorApiKey } from "./config.js";
import { broadcastSse } from "./routes/events.js";

const POLL_INTERVAL_MS   = 5 * 60 * 1000;  // run every 5 minutes
const WINDOW_MINUTES     = 15;              // look back 15 minutes
const CONFIDENCE_THRESHOLD = 0.65;
const ALERT_COOLDOWN_MS  = 10 * 60 * 1000; // don't re-alert within 10 minutes
const MIN_SOURCES        = 2;              // need events from at least 2 different sources
const MIN_EVENTS         = 3;              // need at least 3 events to bother correlating

let lastAlertedAt = 0;
let started = false;

export function startCorrelationPoller(): void {
  if (started) return;
  started = true;
  // First run 30s after startup (let other services settle), then every 5 min
  setTimeout(tick, 30_000);
  setInterval(tick, POLL_INTERVAL_MS);
}

async function tick(): Promise<void> {
  if (!langgraphUrl || !langgraphApiKey) return;

  try {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: events } = await supabase
      .from("startup_events")
      .select("id,source,type,severity,message,user_email,created_at,metadata")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!events || events.length < MIN_EVENTS) return;
    const sources = new Set(events.map(e => e.source));
    if (sources.size < MIN_SOURCES) return;

    const response = await fetch(`${langgraphUrl}/v1/agents/correlate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": langgraphApiKey },
      body: JSON.stringify({ events, window_minutes: WINDOW_MINUTES }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return;

    const result = await response.json() as {
      ok: boolean;
      event_count?: number;
      correlation?: {
        correlated: boolean;
        confidence?: number;
        priority?: string;
        sources_involved?: string[];
        root_cause?: string;
        summary?: string;
        recommended_action?: string;
      };
      similar_context?: unknown[];
    };

    const c = result.correlation;
    if (!c?.correlated || (c.confidence ?? 0) < CONFIDENCE_THRESHOLD) return;

    // Persist to collector — enters AI loop, Supabase, Qdrant memory
    await saveToCollector(c, result.event_count ?? events.length, WINDOW_MINUTES);

    // SSE alert — throttled so we don't spam browsers on every poll
    const now = Date.now();
    if (now - lastAlertedAt > ALERT_COOLDOWN_MS) {
      lastAlertedAt = now;
      broadcastSse({
        type: "correlation_alert",
        correlation: c,
        event_count: result.event_count ?? events.length,
        window_minutes: WINDOW_MINUTES,
      });
    }
  } catch { /* poller is best-effort, never throw */ }
}

export async function saveCorrelationToCollector(
  c: {
    correlated?: boolean;
    confidence?: number;
    priority?: string;
    sources_involved?: string[];
    root_cause?: string;
    summary?: string;
    recommended_action?: string;
  },
  eventCount: number,
  windowMinutes: number
): Promise<void> {
  await saveToCollector(c, eventCount, windowMinutes);
}

async function saveToCollector(
  c: {
    priority?: string;
    sources_involved?: string[];
    root_cause?: string;
    summary?: string;
    recommended_action?: string;
    confidence?: number;
  },
  eventCount: number,
  windowMinutes: number
): Promise<void> {
  if (!collectorUrl || !collectorApiKey) return;

  const sources = (c.sources_involved ?? []).join(", ") || "multiple sources";
  const severity = (c.priority === "critical" || c.priority === "high") ? "high" : "medium";
  const rootCause = c.root_cause ?? c.summary ?? "multiple sources affected simultaneously";
  const message = `Cross-source correlation: ${sources} — ${rootCause}`;

  try {
    await fetch(`${collectorUrl}/v1/events`, {
      method: "POST",
      headers: { "X-API-Key": collectorApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "system.correlation",
        source: "correlator",
        severity,
        message: message.slice(0, 500),
        metadata: {
          correlated: true,
          confidence: c.confidence,
          sources_involved: c.sources_involved,
          root_cause: c.root_cause,
          recommended_action: c.recommended_action,
          event_count: eventCount,
          window_minutes: windowMinutes,
          priority: c.priority,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch { /* fire-and-forget */ }
}
