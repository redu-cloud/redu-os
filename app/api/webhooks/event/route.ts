import type { StartupEvent } from '@/types';

interface WebhookEventRequest {
  type: 'signup' | 'support' | 'analytics' | 'uptime' | 'error' | 'ai' | 'rag' | 'automation';
  source: 'listmonk' | 'zammad' | 'umami' | 'uptime-kuma' | 'glitchtip' | 'activepieces' | 'flowise' | 'custom';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

interface WebhookResponse {
  success: boolean;
  received: boolean;
  id?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Check API key if configured
    const webhookKey = process.env.REDUOS_WEBHOOK_KEY;
    if (webhookKey) {
      const apiKey = request.headers.get('X-API-Key');
      if (!apiKey || apiKey !== webhookKey) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const body: WebhookEventRequest = await request.json();

    // Validate required fields
    if (!body.type || !body.source || !body.title || !body.message) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create event
    const event: StartupEvent = {
      id: `${Date.now()}-${Math.random()}`,
      type: body.type,
      source: body.source,
      title: body.title,
      message: body.message,
      priority: body.priority || 'low',
      timestamp: new Date().toISOString(),
      metadata: body.metadata,
    };

    // In v1, just acknowledge receipt
    // Later: store in database, trigger notifications, feed to AI
    console.log('Received webhook event:', event);

    const response: WebhookResponse = {
      success: true,
      received: true,
      id: event.id,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
