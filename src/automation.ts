import { config } from "./config.js";
import type { StoredEvent } from "./types.js";
import type { AiInsight } from "./ollama.js";

function automationTargets() {
  return [
    config.AUTOMATION_WEBHOOK_URL,
    ...config.AUTOMATION_WEBHOOK_URLS.split(",")
  ]
    .map((url) => url.trim())
    .filter((url, index, urls) => url.length > 0 && urls.indexOf(url) === index);
}

export async function triggerAutomation(
  event: StoredEvent,
  insight: AiInsight,
  meta?: { action_id?: string | null; callback_url?: string }
) {
  const targets = automationTargets();

  if (targets.length === 0) {
    return { sent: false, reason: "automation_disabled" };
  }

  const results = await Promise.all(targets.map(async (url) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.AUTOMATION_WEBHOOK_API_KEY
            ? { "X-API-Key": config.AUTOMATION_WEBHOOK_API_KEY }
            : {})
        },
        body: JSON.stringify({
          event,
          insight,
          ...(meta?.action_id ? { action_id: meta.action_id } : {}),
          ...(meta?.callback_url ? { callback_url: meta.callback_url } : {})
        })
      });

      return {
        url,
        sent: response.ok,
        status: response.status,
        response: await response.text()
      };
    } catch (error) {
      return {
        url,
        sent: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }));

  return {
    sent: results.some((result) => result.sent),
    targets: results.length,
    results
  };
}
