import type { AIBriefing } from '@/types';
import { mockAIBriefing } from '@/lib/mock-operator';

export async function GET(): Promise<Response> {
  // In v1, return mock data
  // Later: fetch from database or AI service
  const briefing: AIBriefing = mockAIBriefing;

  return new Response(JSON.stringify(briefing), {
    headers: { 'Content-Type': 'application/json' },
  });
}
