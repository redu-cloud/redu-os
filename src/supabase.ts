import { createClient } from "@supabase/supabase-js";
import ws from "ws";
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
    },
    realtime: {
      // Node 18 has no native WebSocket — provide the ws package
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transport: ws as any
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

export async function autoFeedbackOnRecovery(
  monitorName: string,
  recoveredEventId: string,
  recoveredAt: Date
): Promise<StoredAiFeedback | null> {
  // Find the most recent down event for this monitor within the last 2 hours
  const windowStart = new Date(recoveredAt.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const { data: downEvents, error: downError } = await supabase
    .from("startup_events")
    .select("id, created_at")
    .eq("type", "uptime.monitor.down")
    .eq("source", "uptime-kuma")
    .filter("metadata->>monitor_name", "eq", monitorName)
    .gte("created_at", windowStart)
    .lt("created_at", recoveredAt.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (downError || !downEvents || downEvents.length === 0) return null;

  const downEvent = downEvents[0] as { id: string; created_at: string };
  const downedAt = new Date(downEvent.created_at);
  const deltaMs = recoveredAt.getTime() - downedAt.getTime();
  const deltaMin = Math.round(deltaMs / 60000);

  // Skip if recovered in under 90 seconds — likely a transient blip not worth recording
  if (deltaMs < 90_000) return null;

  // Find the action that was triggered for the down event
  const { data: actions } = await supabase
    .from("ai_actions")
    .select("id")
    .eq("startup_event_id", downEvent.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const actionId = actions && actions.length > 0 ? (actions[0] as { id: string }).id : null;

  const outcomeText = deltaMin < 10
    ? `Service self-recovered in ${deltaMin} minute${deltaMin === 1 ? "" : "s"} — likely transient`
    : `Service recovered after ${deltaMin} minutes`;

  return storeFeedback({
    startup_event_id: downEvent.id,
    ai_action_id: actionId,
    feedback_type: "auto_recovery",
    score: 1,
    result: "resolved",
    metadata: {
      monitor_name: monitorName,
      down_event_id: downEvent.id,
      recovery_event_id: recoveredEventId,
      delta_minutes: deltaMin,
      outcome: outcomeText
    }
  });
}

export async function autoFeedbackOnTicketResolved(
  ticketId: string | number,
  resolvedEventId: string,
  resolvedAt: Date
): Promise<StoredAiFeedback | null> {
  // Search up to 7 days back for the original ticket.created event
  const windowStart = new Date(resolvedAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: openEvents, error } = await supabase
    .from("startup_events")
    .select("id, created_at")
    .eq("type", "support.ticket.created")
    .eq("source", "zammad")
    .filter("metadata->>ticket_id", "eq", String(ticketId))
    .gte("created_at", windowStart)
    .lt("created_at", resolvedAt.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !openEvents || openEvents.length === 0) return null;

  const openEvent = openEvents[0] as { id: string; created_at: string };
  const openedAt = new Date(openEvent.created_at);
  const deltaMs = resolvedAt.getTime() - openedAt.getTime();
  const deltaHours = Math.round(deltaMs / 3_600_000);

  const { data: actions } = await supabase
    .from("ai_actions")
    .select("id")
    .eq("startup_event_id", openEvent.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const actionId = actions && actions.length > 0 ? (actions[0] as { id: string }).id : null;

  const outcomeText = deltaHours < 1
    ? "Support ticket resolved in under an hour"
    : `Support ticket resolved after ${deltaHours} hour${deltaHours === 1 ? "" : "s"}`;

  return storeFeedback({
    startup_event_id: openEvent.id,
    ai_action_id: actionId,
    feedback_type: "auto_resolution",
    score: 1,
    result: "resolved",
    metadata: {
      ticket_id: ticketId,
      open_event_id: openEvent.id,
      resolution_event_id: resolvedEventId,
      delta_hours: deltaHours,
      outcome: outcomeText
    }
  });
}

export async function autoFeedbackOnUnsubscribe(
  email: string,
  unsubEventId: string,
  unsubAt: Date
): Promise<StoredAiFeedback | null> {
  const windowStart = new Date(unsubAt.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

  const { data: subEvents, error } = await supabase
    .from("startup_events")
    .select("id, created_at")
    .eq("type", "audience.subscriber.created")
    .eq("source", "listmonk")
    .eq("user_email", email)
    .gte("created_at", windowStart)
    .lt("created_at", unsubAt.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !subEvents || subEvents.length === 0) return null;

  const subEvent = subEvents[0] as { id: string; created_at: string };
  const subscribedAt = new Date(subEvent.created_at);
  const deltaMs = unsubAt.getTime() - subscribedAt.getTime();
  const deltaDays = Math.round(deltaMs / 86_400_000);

  const { data: actions } = await supabase
    .from("ai_actions")
    .select("id")
    .eq("startup_event_id", subEvent.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const actionId = actions && actions.length > 0 ? (actions[0] as { id: string }).id : null;

  const outcomeText = deltaDays < 1
    ? "Subscriber churned within 24 hours of joining"
    : `Subscriber churned after ${deltaDays} day${deltaDays === 1 ? "" : "s"}`;

  return storeFeedback({
    startup_event_id: subEvent.id,
    ai_action_id: actionId,
    feedback_type: "auto_unsubscribe",
    score: -1,
    result: "churned",
    metadata: {
      email,
      subscribe_event_id: subEvent.id,
      unsubscribe_event_id: unsubEventId,
      delta_days: deltaDays,
      outcome: outcomeText
    }
  });
}

export async function autoFeedbackOnErrorResolved(
  glitchtipIssueId: string,
  resolvedEventId: string,
  resolvedAt: Date
): Promise<StoredAiFeedback | null> {
  const windowStart = new Date(resolvedAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: createdEvents, error } = await supabase
    .from("startup_events")
    .select("id, created_at")
    .eq("type", "error.created")
    .eq("source", "glitchtip")
    .filter("metadata->>glitchtip_issue_id", "eq", glitchtipIssueId)
    .gte("created_at", windowStart)
    .lt("created_at", resolvedAt.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !createdEvents || createdEvents.length === 0) return null;

  const createdEvent = createdEvents[0] as { id: string; created_at: string };
  const createdAt = new Date(createdEvent.created_at);
  const deltaMs = resolvedAt.getTime() - createdAt.getTime();
  const deltaHours = Math.round(deltaMs / 3_600_000);

  const { data: actions } = await supabase
    .from("ai_actions")
    .select("id")
    .eq("startup_event_id", createdEvent.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const actionId = actions && actions.length > 0 ? (actions[0] as { id: string }).id : null;

  const outcomeText = deltaHours < 1
    ? "Error resolved in under an hour"
    : `Error resolved after ${deltaHours} hour${deltaHours === 1 ? "" : "s"}`;

  return storeFeedback({
    startup_event_id: createdEvent.id,
    ai_action_id: actionId,
    feedback_type: "auto_resolution",
    score: 1,
    result: "resolved",
    metadata: {
      glitchtip_issue_id: glitchtipIssueId,
      error_event_id: createdEvent.id,
      resolution_event_id: resolvedEventId,
      delta_hours: deltaHours,
      outcome: outcomeText
    }
  });
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
