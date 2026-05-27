import type { FastifyInstance } from "fastify";
import { supabase } from "../config.js";

export function register(app: FastifyInstance): void {
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
}
