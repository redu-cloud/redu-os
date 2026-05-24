import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("production"),
  PORT: z.coerce.number().default(3005),
  COLLECTOR_API_KEY: z.string().min(8),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  QDRANT_ENABLED: z.coerce.boolean().default(false),
  QDRANT_URL: z.string().url().default("http://127.0.0.1:6333"),
  QDRANT_API_KEY: z.string().optional().default(""),
  QDRANT_COLLECTION: z.string().default("redu_os_events"),
  QDRANT_FALLBACK_EMBEDDINGS: z.coerce.boolean().default(true),

  AI_ENABLED: z.coerce.boolean().default(false),
  OLLAMA_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("deepseek-r1:8b"),
  OLLAMA_EMBED_MODEL: z.string().default("nomic-embed-text"),

  AUTOMATION_WEBHOOK_URL: z.string().url().optional().or(z.literal("")).default(""),
  AUTOMATION_WEBHOOK_API_KEY: z.string().optional().default(""),

  MAX_EVENT_MESSAGE_LENGTH: z.coerce.number().default(8000)
});

export const config = envSchema.parse(process.env);
