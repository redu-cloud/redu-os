import { config } from "./config.js";
import { traceAiGeneration } from "./langfuse.js";
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

function cleanPriority(value: unknown, fallback: AiInsight["priority"]): AiInsight["priority"] {
  const text = String(value ?? "").toLowerCase();

  if (text.includes("high")) return "High";
  if (text.includes("medium")) return "Medium";
  if (text.includes("low")) return "Low";

  return fallback;
}

function cleanSentiment(value: unknown, fallback: AiInsight["sentiment"]): AiInsight["sentiment"] {
  const text = String(value ?? "").toLowerCase();

  if (text.includes("negative")) return "Negative";
  if (text.includes("positive")) return "Positive";
  if (text.includes("neutral")) return "Neutral";

  return fallback;
}

function cleanCategory(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const invalid = ["low", "medium", "high", "critical", "negative", "neutral", "positive"];

  if (text.length < 2 || invalid.includes(text.toLowerCase())) {
    return fallback;
  }

  return text.slice(0, 120);
}

export async function analyzeEvent(event: StoredEvent): Promise<AiInsight> {
  const startedAt = new Date();

  if (!config.AI_ENABLED) {
    const insight = fallbackInsight(event);
    await traceAiGeneration({
      event,
      prompt: "AI disabled. Fallback insight generated locally.",
      insight,
      rawResponse: insight,
      startedAt,
      endedAt: new Date()
    });
    return insight;
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
      const insight = { ...fallbackInsight(event), raw: data };
      await traceAiGeneration({
        event,
        prompt,
        insight,
        rawResponse: data,
        startedAt,
        endedAt: new Date(),
        error: "Ollama response did not contain JSON"
      });
      return insight;
    }

    const parsed = JSON.parse(match[0]) as Partial<AiInsight>;
    const fallback = fallbackInsight(event);

    const insight = {
      category: cleanCategory(parsed.category, fallback.category),
      priority: cleanPriority(parsed.priority, fallback.priority),
      sentiment: cleanSentiment(parsed.sentiment, fallback.sentiment),
      summary: parsed.summary ?? fallback.summary,
      recommended_action: parsed.recommended_action ?? fallback.recommended_action,
      raw: data
    };
    await traceAiGeneration({
      event,
      prompt,
      insight,
      rawResponse: data,
      startedAt,
      endedAt: new Date()
    });
    return insight;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const insight = {
      ...fallbackInsight(event),
      raw: {
        error: message
      }
    };
    await traceAiGeneration({
      event,
      prompt,
      insight,
      rawResponse: insight.raw,
      startedAt,
      endedAt: new Date(),
      error: message
    });
    return insight;
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
