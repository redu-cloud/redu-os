import { config } from "./config.js";
import { loadPersisted, savePersisted } from "./persist.js";
import type { StoredEvent } from "./types.js";
import type { AiInsight } from "./ollama.js";

// ── Runtime overrides — loaded from file at startup, written on every change ──
interface NotificationOverrides {
  discord_webhook_url?: string | null;
  slack_webhook_url?: string | null;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
}

// Initialise from persisted file so restarts don't lose config
const _persisted = loadPersisted();
let _overrides: NotificationOverrides = { ...(_persisted.notifications ?? {}) };

export function applyNotificationOverrides(patch: NotificationOverrides): void {
  // Filter out `undefined` entries so they don't overwrite existing values
  const clean: NotificationOverrides = {};
  for (const [k, v] of Object.entries(patch) as [keyof NotificationOverrides, string | null | undefined][]) {
    if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
  }
  _overrides = { ..._overrides, ...clean };
  // Persist to disk so the next container start restores this state
  savePersisted({ notifications: _overrides });
}
export function getNotificationOverrides(): NotificationOverrides {
  return { ..._overrides };
}

function notifConfig() {
  return {
    discord_webhook_url: (_overrides.discord_webhook_url ?? config.DISCORD_WEBHOOK_URL) || "",
    slack_webhook_url:   (_overrides.slack_webhook_url   ?? config.SLACK_WEBHOOK_URL)   || "",
    telegram_bot_token:  (_overrides.telegram_bot_token  ?? config.TELEGRAM_BOT_TOKEN)  || "",
    telegram_chat_id:    (_overrides.telegram_chat_id    ?? config.TELEGRAM_CHAT_ID)    || "",
  };
}

// ── Message builders ─────────────────────────────────────────────────────────
function priorityColor(priority: string): number {
  if (priority === "High")   return 0xef4444; // red
  if (priority === "Medium") return 0xf97316; // orange
  return 0x22c55e;                             // green
}

function formatDiscordPayload(event: StoredEvent, insight: AiInsight) {
  const emoji = insight.priority === "High" ? "🔴" : insight.priority === "Medium" ? "🟡" : "🟢";
  return {
    embeds: [{
      title: `${emoji} [${insight.priority}] ${insight.category}`,
      description: insight.summary,
      color: priorityColor(insight.priority),
      fields: [
        { name: "Source",   value: event.source,              inline: true },
        { name: "Type",     value: event.type,                inline: true },
        { name: "Sentiment",value: insight.sentiment,         inline: true },
        { name: "Action",   value: insight.recommended_action, inline: false },
      ],
      footer: { text: `reduOS · ${event.id}` },
      timestamp: event.created_at ?? new Date().toISOString()
    }]
  };
}

function formatSlackPayload(event: StoredEvent, insight: AiInsight) {
  const emoji = insight.priority === "High" ? ":red_circle:" : insight.priority === "Medium" ? ":large_yellow_circle:" : ":large_green_circle:";
  return {
    text: `${emoji} *[${insight.priority}] ${insight.category}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *[${insight.priority}] ${insight.category}*\n${insight.summary}`
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Source:*\n${event.source}` },
          { type: "mrkdwn", text: `*Type:*\n${event.type}` },
          { type: "mrkdwn", text: `*Sentiment:*\n${insight.sentiment}` },
          { type: "mrkdwn", text: `*Priority:*\n${insight.priority}` },
        ]
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Recommended Action:*\n${insight.recommended_action}` }
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `reduOS · ${event.id} · <!date^${Math.floor(new Date(event.created_at ?? Date.now()).getTime() / 1000)}^{date_time}|${event.created_at}>` }]
      }
    ]
  };
}

function formatTelegramText(event: StoredEvent, insight: AiInsight): string {
  const emoji = insight.priority === "High" ? "🔴" : insight.priority === "Medium" ? "🟡" : "🟢";
  return [
    `${emoji} <b>[${insight.priority}] ${insight.category}</b>`,
    ``,
    insight.summary,
    ``,
    `<b>Source:</b> ${event.source}`,
    `<b>Type:</b> ${event.type}`,
    `<b>Sentiment:</b> ${insight.sentiment}`,
    ``,
    `<b>Action:</b> ${insight.recommended_action}`,
    ``,
    `<i>reduOS · ${event.id}</i>`
  ].join("\n");
}

// ── Senders ───────────────────────────────────────────────────────────────────
async function sendDiscord(webhookUrl: string, event: StoredEvent, insight: AiInsight) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formatDiscordPayload(event, insight))
  });
  return { ok: res.ok, status: res.status };
}

async function sendSlack(webhookUrl: string, event: StoredEvent, insight: AiInsight) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formatSlackPayload(event, insight))
  });
  return { ok: res.ok, status: res.status };
}

async function sendTelegram(botToken: string, chatId: string, event: StoredEvent, insight: AiInsight) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatTelegramText(event, insight),
      parse_mode: "HTML"
    })
  });
  return { ok: res.ok, status: res.status };
}

// ── Test senders (use synthetic data) ────────────────────────────────────────
const TEST_EVENT: StoredEvent = {
  id: "00000000-0000-0000-0000-000000000000",
  type: "test.notification",
  source: "reduOS dashboard",
  severity: "medium",
  user_email: null,
  user_name: null,
  message: "This is a test notification from reduOS.",
  metadata: {},
  created_at: new Date().toISOString()
};

const TEST_INSIGHT: AiInsight = {
  category: "Test Notification",
  priority: "Medium",
  sentiment: "Neutral",
  summary: "This is a test notification sent from the reduOS dashboard to verify your notification channel is working correctly.",
  recommended_action: "No action needed. If you received this, your notification channel is configured correctly."
};

export async function testNotification(channel: "discord" | "slack" | "telegram") {
  const nc = notifConfig();
  if (channel === "discord") {
    if (!nc.discord_webhook_url) throw new Error("Discord webhook URL not configured");
    return sendDiscord(nc.discord_webhook_url, TEST_EVENT, TEST_INSIGHT);
  }
  if (channel === "slack") {
    if (!nc.slack_webhook_url) throw new Error("Slack webhook URL not configured");
    return sendSlack(nc.slack_webhook_url, TEST_EVENT, TEST_INSIGHT);
  }
  if (channel === "telegram") {
    if (!nc.telegram_bot_token) throw new Error("Telegram bot token not configured");
    if (!nc.telegram_chat_id)   throw new Error("Telegram chat ID not configured");
    return sendTelegram(nc.telegram_bot_token, nc.telegram_chat_id, TEST_EVENT, TEST_INSIGHT);
  }
  throw new Error(`Unknown channel: ${channel}`);
}

// ── Main send function ────────────────────────────────────────────────────────
export async function sendNotifications(
  event: StoredEvent,
  insight: AiInsight
): Promise<{ discord?: object; slack?: object; telegram?: object }> {
  const nc = notifConfig();
  const results: { discord?: object; slack?: object; telegram?: object } = {};

  await Promise.all([
    nc.discord_webhook_url
      ? sendDiscord(nc.discord_webhook_url, event, insight)
          .then(r  => { results.discord  = r; })
          .catch(e => { results.discord  = { ok: false, error: String(e.message) }; })
      : Promise.resolve(),

    nc.slack_webhook_url
      ? sendSlack(nc.slack_webhook_url, event, insight)
          .then(r  => { results.slack  = r; })
          .catch(e => { results.slack  = { ok: false, error: String(e.message) }; })
      : Promise.resolve(),

    (nc.telegram_bot_token && nc.telegram_chat_id)
      ? sendTelegram(nc.telegram_bot_token, nc.telegram_chat_id, event, insight)
          .then(r  => { results.telegram  = r; })
          .catch(e => { results.telegram  = { ok: false, error: String(e.message) }; })
      : Promise.resolve(),
  ]);

  return results;
}
