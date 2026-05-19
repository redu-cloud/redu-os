import type { RecommendedAction } from '@/types';
import { mockActions } from '@/lib/mock-actions';

export async function GET(): Promise<Response> {
  // In v1, return mock data
  // Later: fetch from database or AI service
  const actions: RecommendedAction[] = mockActions;

  return new Response(JSON.stringify(actions), {
    headers: { 'Content-Type': 'application/json' },
  });
}
