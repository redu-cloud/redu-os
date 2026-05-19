import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { EventFeed } from '@/components/EventFeed';
import { mockEvents } from '@/lib/mock-events';

export default function Events() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900">Event Stream</h1>
            <p className="text-gray-600 mt-2">
              Real-time events from your startup stack. Prioritized by importance.
            </p>
          </div>

          {/* Events */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-12">
            <EventFeed events={mockEvents} />
          </div>

          {/* Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">📥</div>
              <h3 className="font-semibold text-gray-900 mb-2">Webhook Integration</h3>
              <p className="text-sm text-gray-600">
                External tools send events via webhook to <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">POST /api/webhooks/event</code>
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Prioritization</h3>
              <p className="text-sm text-gray-600">
                Events are automatically ranked by priority so you see what matters most first.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="font-semibold text-gray-900 mb-2">Real-Time Updates</h3>
              <p className="text-sm text-gray-600">
                Dashboard updates immediately when new events arrive from your tools.
              </p>
            </div>
          </div>

          {/* Example Webhook */}
          <div className="mt-12 bg-gray-50 rounded-lg border border-gray-200 p-8">
            <h3 className="font-bold text-gray-900 mb-4">Example: Send an Event</h3>
            <p className="text-sm text-gray-600 mb-4">
              Send a test event to reduOS using curl:
            </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs overflow-x-auto">
              <pre>{`curl -X POST http://localhost:3000/api/webhooks/event \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: demo-key" \\
  -d '{
    "type": "support",
    "source": "zammad",
    "title": "User cannot create instance",
    "message": "SSH key configuration confused the user",
    "priority": "high",
    "metadata": {
      "user": "alex_kim",
      "email": "alex@example.com"
    }
  }'`}</pre>
            </div>
          </div>

          {/* Event Types */}
          <div className="mt-12 bg-white rounded-lg border border-gray-200 p-8">
            <h3 className="font-bold text-gray-900 mb-6">Supported Event Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { type: 'signup', emoji: '👤', desc: 'New user signup or waitlist join' },
                { type: 'support', emoji: '💬', desc: 'Support ticket created' },
                { type: 'analytics', emoji: '📊', desc: 'User action or conversion' },
                { type: 'uptime', emoji: '🟢', desc: 'Infrastructure alert' },
                { type: 'error', emoji: '🔴', desc: 'Application error detected' },
                { type: 'ai', emoji: '🤖', desc: 'AI workflow completed' },
                { type: 'rag', emoji: '📚', desc: 'Documents indexed' },
                { type: 'automation', emoji: '⚡', desc: 'Automation triggered' },
              ].map((event) => (
                <div key={event.type} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{event.emoji}</span>
                    <span className="font-semibold text-gray-900">{event.type}</span>
                  </div>
                  <p className="text-sm text-gray-600">{event.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
