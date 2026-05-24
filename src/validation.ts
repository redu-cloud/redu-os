import { z } from "zod";

export const severitySchema = z.enum([
  "debug",
  "info",
  "low",
  "medium",
  "high",
  "critical"
]).default("info");

export const genericEventSchema = z.object({
  type: z.string().min(2).max(120),
  source: z.string().min(2).max(80),
  severity: severitySchema.optional().default("info"),
  user: z.object({
    email: z.string().email().optional(),
    name: z.string().max(200).optional()
  }).optional(),
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional().default({})
});

export const actionSchema = z.object({
  startup_event_id: z.string().uuid(),
  ai_insight_id: z.string().uuid().optional().nullable(),
  action_type: z.string().min(2).max(120),
  status: z.string().min(2).max(80).default("pending"),
  target: z.string().max(120).optional().nullable(),
  payload: z.record(z.unknown()).optional().default({}),
  result: z.record(z.unknown()).optional().default({}),
  completed_at: z.string().datetime().optional().nullable()
});

export const feedbackSchema = z.object({
  startup_event_id: z.string().uuid(),
  ai_action_id: z.string().uuid().optional().nullable(),
  feedback_type: z.string().min(2).max(120),
  score: z.number().int().optional().nullable(),
  result: z.string().max(120).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({})
});

export const similarContextQuerySchema = z.object({
  type: z.string().min(2).max(120).optional(),
  source: z.string().min(2).max(80).optional(),
  user_email: z.string().email().optional(),
  limit: z.coerce.number().int().min(1).max(25).default(5)
});
