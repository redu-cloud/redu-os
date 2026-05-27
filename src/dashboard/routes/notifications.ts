import type { FastifyInstance } from "fastify";
import { collectorUrl, collectorApiKey, jsonHeaders } from "../config.js";

export function register(app: FastifyInstance): void {
  // GET /api/notifications — proxy live state from collector (which owns persistence)
  app.get("/api/notifications", async () => {
    try {
      const res = await fetch(`${collectorUrl}/internal/config`, {
        headers: jsonHeaders(collectorApiKey)
      });
      if (!res.ok) throw new Error(`Collector returned ${res.status}`);
      const data = await res.json() as {
        notifications?: {
          discord?: { configured: boolean };
          slack?:   { configured: boolean };
          telegram?: { configured: boolean; chat_id: string | null };
        }
      };
      const n = data.notifications ?? {};
      return {
        ok: true,
        discord:  { configured: n.discord?.configured  ?? false },
        slack:    { configured: n.slack?.configured    ?? false },
        telegram: { configured: n.telegram?.configured ?? false, chat_id: n.telegram?.chat_id ?? null },
      };
    } catch {
      // Collector unreachable — fall back to env-var check
      return {
        ok: true,
        discord:  { configured: !!(process.env.DISCORD_WEBHOOK_URL) },
        slack:    { configured: !!(process.env.SLACK_WEBHOOK_URL) },
        telegram: { configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
                    chat_id: process.env.TELEGRAM_CHAT_ID || null },
      };
    }
  });

  // PATCH /api/notifications — forward to collector (which persists to disk)
  app.patch("/api/notifications", async (request) => {
    const body = request.body as {
      discord_webhook_url?: string;
      slack_webhook_url?: string;
      telegram_bot_token?: string;
      telegram_chat_id?: string;
    };

    const res = await fetch(`${collectorUrl}/internal/config`, {
      method: "POST",
      headers: jsonHeaders(collectorApiKey),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Collector config update failed: ${res.status}`);

    return { ok: true };
  });

  // POST /api/notifications/test — send a test notification via collector
  app.post("/api/notifications/test", async (request) => {
    const { channel } = request.body as { channel?: string };
    if (!channel || !["discord", "slack", "telegram"].includes(channel)) {
      throw new Error("channel must be one of: discord, slack, telegram");
    }
    const res = await fetch(`${collectorUrl}/internal/notifications/test`, {
      method: "POST",
      headers: jsonHeaders(collectorApiKey),
      body: JSON.stringify({ channel })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => String(res.status));
      throw new Error(`Test failed: ${text}`);
    }
    const data = await res.json() as { ok: boolean; status?: number; error?: string };
    if (!data.ok) throw new Error(data.error ?? "Test notification failed");
    return { ok: true, channel };
  });
}
