export type Severity = "debug" | "info" | "low" | "medium" | "high" | "critical";

export type NormalizedEvent = {
  type: string;
  source: string;
  severity: Severity;
  user_email?: string | null;
  user_name?: string | null;
  message: string;
  metadata: Record<string, unknown>;
};

export type StoredEvent = {
  id: string;
  type: string;
  source: string;
  severity: Severity;
  user_email: string | null;
  user_name: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AiActionInput = {
  startup_event_id: string;
  ai_insight_id?: string | null;
  action_type: string;
  status: string;
  target?: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  completed_at?: string | null;
};

export type StoredAiAction = AiActionInput & {
  id: string;
  created_at: string;
};

export type AiFeedbackInput = {
  startup_event_id: string;
  ai_action_id?: string | null;
  feedback_type: string;
  score?: number | null;
  result?: string | null;
  metadata: Record<string, unknown>;
};

export type StoredAiFeedback = AiFeedbackInput & {
  id: string;
  created_at: string;
};
