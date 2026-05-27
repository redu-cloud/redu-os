import type { FastifyInstance } from "fastify";
import { supabase } from "../config.js";

export function register(app: FastifyInstance): void {
  app.get("/api/insights", async (request) => {
    const q = request.query as Record<string, string>;
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const offset = Number(q.offset ?? 0);

    let query = supabase
      .from("ai_insights")
      .select("*, startup_events(id,type,source,severity,message,created_at)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q.priority) query = query.ilike("priority", q.priority);
    if (q.category) query = query.ilike("category", `%${q.category}%`);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { ok: true, items: data ?? [], total: count ?? 0 };
  });
}
