import type { FastifyInstance } from "fastify";
import { supabase } from "../config.js";

export function register(app: FastifyInstance): void {
  app.get("/api/feedback", async (request) => {
    const q = request.query as Record<string, string>;
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const offset = Number(q.offset ?? 0);

    const { data, error, count } = await supabase
      .from("ai_feedback")
      .select("*, startup_events(id,type,source,message), ai_actions(id,action_type,status)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return { ok: true, items: data ?? [], total: count ?? 0 };
  });

  app.post("/api/feedback/submit", async (request, reply) => {
    const body = request.body as {
      startup_event_id: string;
      ai_action_id?: string;
      feedback_type: string;
      score?: number;
      result?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.startup_event_id || !body.feedback_type) {
      reply.status(400);
      return { ok: false, error: "startup_event_id and feedback_type are required" };
    }

    const { data, error } = await supabase
      .from("ai_feedback")
      .insert({
        startup_event_id: body.startup_event_id,
        ai_action_id: body.ai_action_id ?? null,
        feedback_type: body.feedback_type,
        score: body.score ?? null,
        result: body.result ?? null,
        metadata: body.metadata ?? {}
      })
      .select()
      .single();

    if (error) { reply.status(500); return { ok: false, error: error.message }; }
    return { ok: true, feedback: data };
  });
}
