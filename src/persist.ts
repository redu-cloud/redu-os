/**
 * Shared persistence for runtime config overrides.
 * Written to a file that survives container restarts via the .local/ volume mount.
 * Both notifications and AI config use this module.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const PERSIST_PATH =
  process.env.RUNTIME_CONFIG_PATH ?? "/app/.local/runtime-config.json";

export interface PersistedConfig {
  notifications?: {
    discord_webhook_url?: string | null;
    slack_webhook_url?: string | null;
    telegram_bot_token?: string | null;
    telegram_chat_id?: string | null;
  };
  ai?: {
    ai_provider?: string | null;
    ai_chat_model?: string | null;
    ai_chat_base_url?: string | null;
    ai_chat_api_key?: string | null;
    ollama_model?: string | null;
    ollama_embed_model?: string | null;
    require_approval_severity?: string | null;
  };
}

export function loadPersisted(): PersistedConfig {
  try {
    return JSON.parse(readFileSync(PERSIST_PATH, "utf8")) as PersistedConfig;
  } catch {
    return {};
  }
}

export function savePersisted(data: Partial<PersistedConfig>): void {
  try {
    mkdirSync(dirname(PERSIST_PATH), { recursive: true });
    const existing = loadPersisted();
    // Deep-merge one level: each top-level section (notifications, ai) is merged independently
    const merged: PersistedConfig = { ...existing };
    for (const key of Object.keys(data) as (keyof PersistedConfig)[]) {
      (merged as Record<string, unknown>)[key] = {
        ...((existing as Record<string, unknown>)[key] as object ?? {}),
        ...((data as Record<string, unknown>)[key] as object ?? {})
      };
    }
    writeFileSync(PERSIST_PATH, JSON.stringify(merged, null, 2));
  } catch {
    // Best-effort — don't crash if the directory isn't mounted (dev mode)
  }
}
