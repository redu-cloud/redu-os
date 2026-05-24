import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "./config.js";
import type { StoredEvent } from "./types.js";
import { embedText } from "./ollama.js";

const client = new QdrantClient({
  url: config.QDRANT_URL,
  apiKey: config.QDRANT_API_KEY || undefined
});

async function ensureCollection(vectorSize: number) {
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === config.QDRANT_COLLECTION);

  if (!exists) {
    await client.createCollection(config.QDRANT_COLLECTION, {
      vectors: {
        size: vectorSize,
        distance: "Cosine"
      }
    });
  }
}

export async function rememberEvent(event: StoredEvent) {
  if (!config.QDRANT_ENABLED) {
    return { stored: false, reason: "qdrant_disabled" };
  }

  const text = [
    `type: ${event.type}`,
    `source: ${event.source}`,
    `severity: ${event.severity}`,
    event.user_email ? `user_email: ${event.user_email}` : "",
    event.user_name ? `user_name: ${event.user_name}` : "",
    `message: ${event.message}`,
    `metadata: ${JSON.stringify(event.metadata)}`
  ].filter(Boolean).join("\n");

  const vector = await embedText(text);
  if (!vector) {
    return { stored: false, reason: "embedding_failed" };
  }

  await ensureCollection(vector.length);

  await client.upsert(config.QDRANT_COLLECTION, {
    points: [
      {
        id: event.id,
        vector,
        payload: {
          type: event.type,
          source: event.source,
          severity: event.severity,
          user_email: event.user_email,
          user_name: event.user_name,
          message: event.message,
          metadata: event.metadata,
          created_at: event.created_at
        }
      }
    ]
  });

  return { stored: true };
}
