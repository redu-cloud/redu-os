/**
 * Polls Umami for custom events every 30 s and forwards them to the collector.
 * Only custom events (eventType === 2, i.e. umami.track() calls) are forwarded —
 * automatic pageviews are excluded to avoid flooding the AI loop.
 */
import { umamiApiUrl, umamiAdminUsername, umamiAdminPassword, collectorUrl, collectorApiKey, jsonHeaders } from "./config.js";
import { umamiWebsiteId as dashboardWebsiteId } from "./umami.js";

const POLL_MS   = 30_000;
const OVERLAP_MS = 10_000; // 10s backward overlap to handle clock skew

// Bounded seen-ID set — avoids re-forwarding events in the overlap window
const seenIds = new Set<string>();
const MAX_SEEN = 2_000;

function addSeen(id: string) {
  if (seenIds.size >= MAX_SEEN) {
    // Evict oldest entries (Sets iterate in insertion order)
    const iter = seenIds.values();
    for (let i = 0; i < 200; i++) seenIds.delete(iter.next().value!);
  }
  seenIds.add(id);
}

let token: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string | null> {
  if (token && Date.now() < tokenExpiry) return token;
  try {
    const res = await fetch(`${umamiApiUrl}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username: umamiAdminUsername, password: umamiAdminPassword }),
      signal:  AbortSignal.timeout(5_000)
    });
    if (!res.ok) return null;
    const d = await res.json() as { token?: string };
    token = d.token ?? null;
    tokenExpiry = Date.now() + 23 * 3_600_000; // tokens last 24h; refresh at 23h
    return token;
  } catch { return null; }
}

async function getWebsites(tok: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await fetch(`${umamiApiUrl}/api/websites?pageSize=50`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal:  AbortSignal.timeout(5_000)
    });
    if (!res.ok) return [];
    const d = await res.json() as { data?: Array<{ id: string; name: string }> };
    return d.data ?? [];
  } catch { return []; }
}

type UmamiEvent = {
  id: string;
  createdAt: string;
  urlPath: string;
  eventType: number;    // 1 = pageview, 2 = custom
  eventName?: string;
  browser?: string;
  os?: string;
  device?: string;
  country?: string;
};

function severityFor(name: string): "info" | "medium" | "high" {
  const n = name.toLowerCase();
  if (["purchase","payment","checkout","upgrade","revenue"].some(k => n.includes(k))) return "high";
  if (["signup","register","subscribe","plan","contact","lead","trial"].some(k => n.includes(k))) return "medium";
  return "info";
}

async function forwardEvent(ev: UmamiEvent, websiteName: string): Promise<void> {
  const type     = ev.eventName ?? "custom-event";
  const severity = severityFor(type);
  const message  = `${type} on ${ev.urlPath}`;

  await fetch(`${collectorUrl}/v1/events`, {
    method:  "POST",
    headers: jsonHeaders(collectorApiKey),
    body:    JSON.stringify({
      source:   "umami",
      type,
      severity,
      message,
      metadata: {
        website:       websiteName,
        url:           ev.urlPath,
        browser:       ev.browser,
        os:            ev.os,
        device:        ev.device,
        country:       ev.country,
        umamiEventId:  ev.id,
      }
    })
    // no AbortSignal — collector AI loop can take ~15s
  });
}

async function pollWebsite(tok: string, website: { id: string; name: string }, since: number): Promise<void> {
  const now = Date.now();
  try {
    const url = `${umamiApiUrl}/api/websites/${website.id}/events?startAt=${since}&endAt=${now}&pageSize=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tok}` },
      signal:  AbortSignal.timeout(10_000)
    });
    if (!res.ok) return;
    const d = await res.json() as { data?: UmamiEvent[] };
    const events = (d.data ?? []).filter(e => e.eventType === 2 && !seenIds.has(e.id));

    for (const ev of events) {
      addSeen(ev.id);
      forwardEvent(ev, website.name).catch(() => {});
    }

    if (events.length > 0) {
      console.log(`[umami-poller] forwarded ${events.length} event(s) from "${website.name}"`);
    }
  } catch { /* transient — will retry next poll */ }
}

let lastPollTime = Date.now() - OVERLAP_MS;

async function poll(): Promise<void> {
  const since = lastPollTime - OVERLAP_MS;
  lastPollTime = Date.now();

  const tok = await getToken();
  if (!tok) return;

  const websites = await getWebsites(tok);
  // Skip the website that tracks the dashboard itself — its events are internal
  // navigation noise, not customer signals.
  const external = websites.filter(w => w.id !== dashboardWebsiteId);
  await Promise.all(external.map(w => pollWebsite(tok, w, since)));
}

export function startUmamiPoller(): void {
  if (!umamiApiUrl || !umamiAdminPassword) {
    console.log("[umami-poller] Umami not configured — skipping event relay");
    return;
  }
  console.log(`[umami-poller] starting — polling every ${POLL_MS / 1000}s`);
  // Delay first poll to let Umami and collector finish starting up
  setTimeout(() => {
    poll().catch(() => {});
    setInterval(() => poll().catch(() => {}), POLL_MS);
  }, 15_000);
}
