import type { FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";
import { supabase } from "../config.js";

// ── SSE shared broadcast state ─────────────────────────────────────────────
// One Supabase poller fans out to all connected browser clients.
const sseClients = new Set<ServerResponse>();
let lastSeen: string | null = null;
let pollerStarted = false;

function broadcastSse(payload: object): void {
  if (sseClients.size === 0) return;
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of [...sseClients]) {
    try { client.write(msg); }
    catch { sseClients.delete(client); }
  }
}

function startPoller(): void {
  if (pollerStarted) return;
  pollerStarted = true;
  setInterval(async () => {
    if (sseClients.size === 0 || !lastSeen) return;
    try {
      const { data } = await supabase
        .from("startup_events")
        .select("id,source,severity,type,message,created_at")
        .gt("created_at", lastSeen)
        .order("created_at", { ascending: true })
        .limit(20);
      if (data?.length) {
        lastSeen = data[data.length - 1].created_at;
        broadcastSse({ type: "events", events: data });
      }
    } catch { /* ignore polling errors */ }
  }, 4000);
}

export function register(app: FastifyInstance): void {
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

  // ── SSE stream — real-time event push ────────────────────────────────────
  app.get("/api/events/stream", async (request, reply) => {
    reply.hijack();
    const res = reply.raw;

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.writeHead(200);

    // Anchor lastSeen to now so the poller only pushes events that arrive after
    // this connection was established.
    if (!lastSeen) lastSeen = new Date().toISOString();

    // Confirm SSE is ready
    res.write(`data: ${JSON.stringify({ type: "ready" })}\n\n`);

    sseClients.add(res);
    startPoller();

    // Keep-alive heartbeat (prevents proxy / browser timeouts)
    const hb = setInterval(() => {
      try { res.write(": heartbeat\n\n"); }
      catch { clearInterval(hb); sseClients.delete(res); }
    }, 25000);

    request.raw.on("close", () => {
      clearInterval(hb);
      sseClients.delete(res);
    });

    // Hold the handler open until the client disconnects.
    // reply.hijack() prevents Fastify from sending its own response on resolve.
    await new Promise<void>(resolve => request.raw.on("close", resolve));
  });
}
