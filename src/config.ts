import "dotenv/config";
import { existsSync } from "node:fs";
import { z } from "zod";

// When running inside a container (Podman/Docker), service URLs using 127.0.0.1
// point to the container's own loopback — unreachable. Rewrite to host.containers.internal.
const IN_CONTAINER = existsSync("/run/.containerenv") || existsSync("/.dockerenv");
function containerizeUrl(key: string): void {
  if (IN_CONTAINER && process.env[key]) {
    process.env[key] = process.env[key]!.replace(/127\.0\.0\.1/g, "host.containers.internal");
  }
}
// Rewrite before Zod freezes the config
["QDRANT_URL", "OLLAMA_URL", "SUPABASE_URL", "AI_CHAT_BASE_URL", "AI_EMBEDDING_BASE_URL"].forEach(containerizeUrl);

const envBoolean = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;

    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off", ""].includes(normalized)) return false;

    return value;
  }, z.boolean().default(defaultValue));

const envSchema = z.object({
  NODE_ENV: z.string().default("production"),
  PORT: z.coerce.number().default(3005),
  COLLECTOR_API_KEY: z.string().min(8),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  QDRANT_ENABLED: envBoolean(true),
  QDRANT_URL: z.string().url().default("http://127.0.0.1:6333"),
  QDRANT_API_KEY: z.string().optional().default(""),
  QDRANT_COLLECTION: z.string().default("redu_os_events"),
  QDRANT_FALLBACK_EMBEDDINGS: envBoolean(true),

  AI_ENABLED: envBoolean(false),
  AI_PROVIDER: z.enum(["fallback", "ollama", "litellm", "openai-compatible"]).default("ollama"),
  DEBUG_AI_RAW: envBoolean(false),
  OLLAMA_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("deepseek-r1:8b"),
  OLLAMA_EMBED_MODEL: z.string().default("nomic-embed-text"),
  AI_CHAT_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  AI_CHAT_API_KEY: z.string().optional().default(""),
  AI_CHAT_MODEL: z.string().optional().default(""),
  AI_EMBEDDING_BASE_URL: z.string().url().optional().or(z.literal("")).default(""),
  AI_EMBEDDING_API_KEY: z.string().optional().default(""),
  AI_EMBEDDING_MODEL: z.string().optional().default(""),

  LANGFUSE_ENABLED: envBoolean(false),
  LANGFUSE_HOST: z.string().url().optional().or(z.literal("")).default(""),
  LANGFUSE_PUBLIC_KEY: z.string().optional().default(""),
  LANGFUSE_SECRET_KEY: z.string().optional().default(""),
  LANGFUSE_TIMEOUT_MS: z.coerce.number().default(2500),

  AUTOMATION_WEBHOOK_URL: z.string().url().optional().or(z.literal("")).default(""),
  AUTOMATION_WEBHOOK_URLS: z.string().optional().default(""),
  AUTOMATION_WEBHOOK_API_KEY: z.string().optional().default(""),

  // ── Notifications ──────────────────────────────────────────────────────────
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal("")).default(""),
  SLACK_WEBHOOK_URL:   z.string().url().optional().or(z.literal("")).default(""),
  TELEGRAM_BOT_TOKEN:  z.string().optional().default(""),
  TELEGRAM_CHAT_ID:    z.string().optional().default(""),

  REQUIRE_APPROVAL_SEVERITY: z.string().optional().default(""),
  MAX_EVENT_MESSAGE_LENGTH: z.coerce.number().default(8000)
});

export const config = envSchema.parse(process.env);
