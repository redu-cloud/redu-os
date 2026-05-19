import type { StartupEvent } from '@/types';
import { mockEvents } from '@/lib/mock-events';

export async function GET(): Promise<Response> {
  // In v1, return mock data
  // Later: fetch from database
  const events: StartupEvent[] = mockEvents;

  return new Response(JSON.stringify(events), {
    headers: { 'Content-Type': 'application/json' },
  });
}
