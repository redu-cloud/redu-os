import type { OperatorResponse } from '@/types';
import { mockOperatorResponses } from '@/lib/mock-operator';

interface OperatorRequest {
  prompt: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: OperatorRequest = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let response: OperatorResponse;

    // Check if OLLAMA_BRIDGE_URL is configured
    const ollamaUrl = process.env.OLLAMA_BRIDGE_URL;
    const apiKey = process.env.AI_API_KEY;

    if (ollamaUrl && apiKey) {
      // Call external AI service
      try {
        const externalResponse = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({
            prompt: `You are reduOS, an AI operating system for startup teams. Answer the founder's question using startup context and available data. Be concise and actionable. Question: ${prompt}`,
          }),
        });

        if (externalResponse.ok) {
          const data = await externalResponse.json();
          response = {
            response: data.response || 'Unable to generate response',
            timestamp: new Date().toISOString(),
          };
        } else {
          // Fall back to mock response
          response = getMockResponse(prompt);
        }
      } catch {
        // Fall back to mock response
        response = getMockResponse(prompt);
      }
    } else {
      // Use mock responses in v1
      response = getMockResponse(prompt);
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function getMockResponse(prompt: string): OperatorResponse {
  const lowerPrompt = prompt.toLowerCase();

  // Find matching mock response
  for (const [key, value] of Object.entries(mockOperatorResponses)) {
    if (key !== 'default' && lowerPrompt.includes(key.toLowerCase().split('?')[0])) {
      return {
        response: value,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Return default response
  return {
    response: mockOperatorResponses.default,
    timestamp: new Date().toISOString(),
  };
}
