import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import type {
  AiActionInput,
  AiFeedbackInput,
  NormalizedEvent,
  StoredAiAction,
  StoredAiFeedback,
  StoredEvent
} from "./types.js";

export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export async function storeEvent(event: NormalizedEvent): Promise<StoredEvent> {
  const { data, error } = await supabase
    .from("startup_events")
    .insert({
      type: event.type,
      source: event.source,
      severity: event.severity,
      user_email: event.user_email ?? null,
      user_name: event.user_name ?? null,
      message: event.message,
      metadata: event.metadata
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  return data as StoredEvent;
}

export async function storeInsight(input: {
  startup_event_id: string;
  category: string;
  priority: string;
  sentiment: string;
  summary: string;
  recommended_action: string;
  ai_model?: string;
  raw?: unknown;
}) {
  const { data, error } = await supabase
    .from("ai_insights")
    .insert({
      startup_event_id: input.startup_event_id,
      category: input.category,
      priority: input.priority,
      sentiment: input.sentiment,
      summary: input.summary,
      recommended_action: input.recommended_action,
      ai_model: input.ai_model ?? null,
      metadata: input.raw ? { raw: input.raw } : {}
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase insight insert failed: ${error.message}`);
  }

  return data;
}

export async function storeAction(input: AiActionInput): Promise<StoredAiAction> {
  const { data, error } = await supabase
    .from("ai_actions")
    .insert({
      startup_event_id: input.startup_event_id,
      ai_insight_id: input.ai_insight_id ?? null,
      action_type: input.action_type,
      status: input.status,
      target: input.target ?? null,
      payload: input.payload,
      result: input.result,
      completed_at: input.completed_at ?? null
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase action insert failed: ${error.message}`);
  }

  return data as StoredAiAction;
}

export async function storeFeedback(input: AiFeedbackInput): Promise<StoredAiFeedback> {
  const { data, error } = await supabase
    .from("ai_feedback")
    .insert({
      startup_event_id: input.startup_event_id,
      ai_action_id: input.ai_action_id ?? null,
      feedback_type: input.feedback_type,
      score: input.score ?? null,
      result: input.result ?? null,
      metadata: input.metadata
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase feedback insert failed: ${error.message}`);
  }

  return data as StoredAiFeedback;
}

export async function getSimilarContext(input: {
  type?: string;
  source?: string;
  user_email?: string;
  limit: number;
}) {
  let query = supabase
    .from("startup_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input.limit);

  if (input.type) query = query.eq("type", input.type);
  if (input.source) query = query.eq("source", input.source);
  if (input.user_email) query = query.eq("user_email", input.user_email);

  const { data: events, error } = await query;

  if (error) {
    throw new Error(`Supabase context query failed: ${error.message}`);
  }

  const storedEvents = (events ?? []) as StoredEvent[];
  const eventIds = storedEvents.map((event) => event.id);

  if (eventIds.length === 0) {
    return [];
  }

  const [insightsResult, actionsResult, feedbackResult] = await Promise.all([
    supabase.from("ai_insights").select("*").in("startup_event_id", eventIds),
    supabase.from("ai_actions").select("*").in("startup_event_id", eventIds),
    supabase.from("ai_feedback").select("*").in("startup_event_id", eventIds)
  ]);

  if (insightsResult.error) {
    throw new Error(`Supabase insights context query failed: ${insightsResult.error.message}`);
  }

  if (actionsResult.error) {
    throw new Error(`Supabase actions context query failed: ${actionsResult.error.message}`);
  }

  if (feedbackResult.error) {
    throw new Error(`Supabase feedback context query failed: ${feedbackResult.error.message}`);
  }

  const insights = insightsResult.data ?? [];
  const actions = actionsResult.data ?? [];
  const feedback = feedbackResult.data ?? [];

  return storedEvents.map((event) => ({
    event,
    insights: insights.filter((item) => item.startup_event_id === event.id),
    actions: actions.filter((item) => item.startup_event_id === event.id),
    feedback: feedback.filter((item) => item.startup_event_id === event.id)
  }));
}
