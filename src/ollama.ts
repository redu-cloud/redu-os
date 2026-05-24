import { config } from "./config.js";
import type { StoredEvent } from "./types.js";

export type AiInsight = {
  category: string;
  priority: "Low" | "Medium" | "High";
  sentiment: "Negative" | "Neutral" | "Positive";
  summary: string;
  recommended_action: string;
  raw?: unknown;
};

function fallbackInsight(event: StoredEvent): AiInsight {
  return {
    category: event.type.includes("error")
      ? "Production Error"
      : event.type.includes("support")
        ? "Customer Support"
        : event.type.includes("uptime")
          ? "Reliability"
          : "General Event",
    priority: event.severity === "critical" || event.severity === "high" ? "High" : "Medium",
    sentiment: event.severity === "critical" || event.severity === "high" ? "Negative" : "Neutral",
    summary: event.message.slice(0, 500),
    recommended_action: "Review this event and decide whether it should become a product, support, or reliability task."
  };
}

export async function analyzeEvent(event: StoredEvent): Promise<AiInsight> {
  if (!config.AI_ENABLED) {
    return fallbackInsight(event);
  }

  const prompt = `
You are an AI operations analyst for a startup.
Analyze this event and return compact JSON only.

Required keys:
category, priority, sentiment, summary, recommended_action

Allowed priority values: Low, Medium, High
Allowed sentiment values: Negative, Neutral, Positive

Event:
${JSON.stringify(event, null, 2)}
`;

  try {
    const response = await fetch(`${config.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.OLLAMA_MODEL,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json() as { response?: string };
    const text = data.response ?? "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { ...fallbackInsight(event), raw: data };
    }

    const parsed = JSON.parse(match[0]) as Partial<AiInsight>;

    return {
      category: parsed.category ?? fallbackInsight(event).category,
      priority: parsed.priority ?? fallbackInsight(event).priority,
      sentiment: parsed.sentiment ?? fallbackInsight(event).sentiment,
      summary: parsed.summary ?? fallbackInsight(event).summary,
      recommended_action: parsed.recommended_action ?? fallbackInsight(event).recommended_action,
      raw: data
    };
  } catch (error) {
    return {
      ...fallbackInsight(event),
      raw: {
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

export async function embedText(text: string): Promise<number[] | null> {
  if (!config.QDRANT_ENABLED) return null;

  try {
    const response = await fetch(`${config.OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.OLLAMA_EMBED_MODEL,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama embeddings returned ${response.status}`);
    }

    const data = await response.json() as { embedding?: number[] };
    return data.embedding ?? null;
  } catch {
    if (!config.QDRANT_FALLBACK_EMBEDDINGS) {
      return null;
    }

    return hashEmbedding(text, 768);
  }
}

function hashEmbedding(text: string, size: number) {
  const vector = new Array<number>(size).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9_:-]+/g) ?? [];

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const index = Math.abs(hash) % size;
    vector[index] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}
