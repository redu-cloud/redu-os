import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { IntegrationCard } from '@/components/IntegrationCard';
import { mockIntegrations } from '@/lib/mock-integrations';

export default function Stack() {
  const categories = [
    { id: 'ai', name: '🤖 AI & RAG' },
    { id: 'analytics', name: '📊 Analytics' },
    { id: 'support', name: '💬 Support' },
    { id: 'monitoring', name: '📈 Monitoring' },
    { id: 'automation', name: '⚡ Automation' },
    { id: 'database', name: '🗄️ Database' },
    { id: 'backend', name: '🔧 Backend' },
    { id: 'errors', name: '🔴 Error Tracking' },
    { id: 'newsletter', name: '📧 Newsletter' },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900">Startup Stack</h1>
            <p className="text-gray-600 mt-2">
              Open-source tools powering reduOS. All integrations ready to connect.
            </p>
          </div>

          {/* Integrations by category */}
          {categories.map((category) => {
            const categoryIntegrations = mockIntegrations.filter((i) => i.category === category.id);
            if (categoryIntegrations.length === 0) return null;

            return (
              <div key={category.id} className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{category.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryIntegrations.map((integration) => (
                    <IntegrationCard key={integration.id} integration={integration} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Architecture */}
          <div className="mt-16 bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Architecture</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                reduOS is built as an open-source application running on{' '}
                <a href="https://redu.cloud" className="text-primary-600 hover:underline">
                  redu.cloud
                </a>
                . All integrations are optional and can be configured via environment variables.
              </p>
              <p>
                Data flows through webhooks and scheduled jobs. The dashboard is real-time. The AI operator runs locally via Ollama/DeepSeek or can call an external LLM API. Everything stays private.
              </p>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="font-semibold text-gray-900 mb-4">Data flow:</p>
                <div className="bg-gray-50 p-4 rounded font-mono text-sm">
                  <p>External tools → Webhooks → reduOS API → Events database</p>
                  <p className="mt-2">reduOS dashboard ← Events database</p>
                  <p className="mt-2">User question → AI operator → Local/remote LLM → Response</p>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="mt-12 bg-primary-50 rounded-lg border border-primary-200 p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Getting Started</h3>
            <ol className="space-y-3 text-gray-700">
              <li>
                <span className="font-semibold">1. Check the .env.example file</span> for all available integrations and configuration options.
              </li>
              <li>
                <span className="font-semibold">2. Start with one integration</span> — Umami for analytics or Zammad for support are good starting points.
              </li>
              <li>
                <span className="font-semibold">3. Configure webhooks</span> to send events to reduOS.
              </li>
              <li>
                <span className="font-semibold">4. Set up Ollama locally</span> or configure an external LLM API for the AI operator.
              </li>
              <li>
                <span className="font-semibold">5. Deploy to redu.cloud</span> to run your startup command center.
              </li>
            </ol>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
