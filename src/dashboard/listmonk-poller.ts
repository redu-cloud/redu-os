/**
 * Polls Listmonk every 60 s for newly-unsubscribed contacts and forwards them
 * to the collector as `audience.subscriber.unsubscribed` events.
 *
 * Listmonk v6 has no outbound webhooks for subscriber events, so polling is
 * the only option. Subscriptions are captured in the /api/listmonk/subscribe
 * proxy instead.
 */
import { listmonkUrl, listmonkAdminUsername, listmonkAdminPassword, listmonkListName, collectorUrl, collectorApiKey, jsonHeaders } from "./config.js";

const POLL_MS = 60_000;

// Track emails we've already forwarded as unsubscribed in this session
const seenUnsubscribed = new Set<string>();
const MAX_SEEN = 2_000;

function addSeen(email: string) {
  if (seenUnsubscribed.size >= MAX_SEEN) {
    const iter = seenUnsubscribed.values();
    for (let i = 0; i < 200; i++) seenUnsubscribed.delete(iter.next().value!);
  }
  seenUnsubscribed.add(email);
}

function listmonkAuth(): string {
  return "Basic " + Buffer.from(`${listmonkAdminUsername}:${listmonkAdminPassword}`).toString("base64");
}

type ListmonkSubscriber = {
  id: number;
  email: string;
  name?: string;
  status: string;
  updated_at?: string;
};

async function forwardUnsubscribe(sub: ListmonkSubscriber): Promise<void> {
  const label = sub.name ? `${sub.name} (${sub.email})` : sub.email;
  await fetch(`${collectorUrl}/v1/events`, {
    method:  "POST",
    headers: jsonHeaders(collectorApiKey),
    body:    JSON.stringify({
      source:   "listmonk",
      type:     "audience.subscriber.unsubscribed",
      severity: "medium",
      message:  `${label} unsubscribed from ${listmonkListName}`,
      user:     { email: sub.email, name: sub.name || undefined },
      metadata: {
        list_name:       listmonkListName,
        subscriber_id:   sub.id,
        event:           "subscriber.unsubscribed",
        subscriber_name: sub.name,
      }
    })
    // fire-and-forget
  });
}

async function poll(): Promise<void> {
  if (!listmonkUrl) return;
  try {
    // Fetch recently-updated unsubscribed contacts (25 per poll, newest first)
    const url = `${listmonkUrl}/api/subscribers?page=1&per_page=25&order_by=updated_at&order=DESC&query=subscribers.status%3D'unsubscribed'`;
    const res = await fetch(url, {
      headers: { Authorization: listmonkAuth() },
      signal:  AbortSignal.timeout(8_000)
    });
    if (!res.ok) return;

    const d = await res.json() as { data?: { results?: ListmonkSubscriber[] } };
    const subscribers = d.data?.results ?? [];

    const newUnsubs = subscribers.filter(s => s.email && !seenUnsubscribed.has(s.email));
    for (const sub of newUnsubs) {
      addSeen(sub.email);
      forwardUnsubscribe(sub).catch(() => {});
    }

    if (newUnsubs.length > 0) {
      console.log(`[listmonk-poller] forwarded ${newUnsubs.length} unsubscribe(s)`);
    }
  } catch { /* transient — retry next poll */ }
}

export function startListmonkPoller(): void {
  if (!listmonkUrl || !listmonkAdminPassword) {
    console.log("[listmonk-poller] Listmonk not configured — skipping unsubscribe relay");
    return;
  }
  console.log(`[listmonk-poller] starting — polling every ${POLL_MS / 1000}s`);
  setTimeout(() => {
    poll().catch(() => {});
    setInterval(() => poll().catch(() => {}), POLL_MS);
  }, 25_000);
}
