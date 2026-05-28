import type { FastifyInstance } from "fastify";
import { supabase, qdrantUrl, qdrantApiKey, qdrantCollection } from "../config.js";

const TABLES = ["startup_events", "ai_insights", "ai_actions", "ai_feedback"] as const;

export function register(app: FastifyInstance): void {
  app.post("/api/reset", async () => {
    const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};

    // ── 1. Truncate all event/insight/action/feedback rows ────────────────────
    for (const table of TABLES) {
      try {
        const { error, count } = await supabase
          .from(table)
          .delete()
          .not("id", "is", null);   // matches every row (id uuid primary key is always non-null)
        results[table] = error
          ? { ok: false, error: error.message }
          : { ok: true, count: count ?? 0 };
      } catch (e) {
        results[table] = { ok: false, error: String(e) };
      }
    }

    // ── 2. Drop Qdrant collection (auto-recreated on next embed upsert) ────────
    if (qdrantUrl) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (qdrantApiKey) headers["api-key"] = qdrantApiKey;
        const res = await fetch(`${qdrantUrl}/collections/${qdrantCollection}`, {
          method: "DELETE",
          headers,
          signal: AbortSignal.timeout(10_000)
        });
        results["qdrant_memory"] = { ok: res.ok };
      } catch (e) {
        results["qdrant_memory"] = { ok: false, error: String(e) };
      }
    }

    return { ok: true, results };
  });
}
