import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { MetricCard } from '@/components/MetricCard';
import { StartupPulseCard } from '@/components/StartupPulseCard';
import { EventFeed } from '@/components/EventFeed';
import { mockMetrics } from '@/lib/mock-metrics';
import { mockEvents } from '@/lib/mock-events';
import { mockAIBriefing } from '@/lib/mock-operator';

export default function Dashboard() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900">Command Center</h1>
            <p className="text-gray-600 mt-2">
              Real-time view of your startup. Updated every minute.
            </p>
          </div>

          {/* Startup Pulse */}
          <div className="mb-12">
            <StartupPulseCard briefing={mockAIBriefing} />
          </div>

          {/* Metrics Grid */}
          <div className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Key Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mockMetrics.map((metric, i) => (
                <MetricCard key={i} metric={metric} />
              ))}
            </div>
          </div>

          {/* Recent Events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Events</h2>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <EventFeed events={mockEvents} />
              </div>
            </div>

            {/* Suggested Actions */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Status Overview</h2>
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">Infrastructure</p>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <p className="text-xs text-gray-600">All systems operational</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">API Performance</p>
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  </div>
                  <p className="text-xs text-gray-600">5 timeouts detected</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">Support Queue</p>
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  </div>
                  <p className="text-xs text-gray-600">8 open tickets</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">AI Workflows</p>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <p className="text-xs text-gray-600">142 completed today</p>
                </div>

                <div className="bg-primary-50 rounded-lg border border-primary-200 p-4 mt-6">
                  <p className="text-xs font-semibold text-primary-600 uppercase mb-2">Next Action</p>
                  <p className="text-sm font-medium text-gray-900">
                    Improve SSH onboarding documentation
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Blocking 25% of user conversions
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Integration Health */}
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Integration Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { name: 'Listmonk', status: 'connected' },
                { name: 'Zammad', status: 'connected' },
                { name: 'Umami', status: 'connected' },
                { name: 'Uptime Kuma', status: 'connected' },
                { name: 'Qdrant', status: 'demo' },
                { name: 'Ollama', status: 'demo' },
              ].map((integration, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <p className="text-sm font-medium text-gray-900 mb-2">{integration.name}</p>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      integration.status === 'connected'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {integration.status === 'connected' ? '✓ Connected' : 'Demo'}
                  </span>
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
