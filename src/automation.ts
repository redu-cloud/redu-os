import { config } from "./config.js";
import type { StoredEvent } from "./types.js";
import type { AiInsight } from "./ollama.js";

export async function triggerAutomation(event: StoredEvent, insight: AiInsight) {
  if (!config.AUTOMATION_WEBHOOK_URL) {
    return { sent: false, reason: "automation_disabled" };
  }

  try {
    const response = await fetch(config.AUTOMATION_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.AUTOMATION_WEBHOOK_API_KEY
          ? { "X-API-Key": config.AUTOMATION_WEBHOOK_API_KEY }
          : {})
      },
      body: JSON.stringify({
        event,
        insight
      })
    });

    return {
      sent: response.ok,
      status: response.status,
      response: await response.text()
    };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
