import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        {/* Hero */}
        <section className="relative px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Run your startup with an open-source AI operating system.
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                reduOS connects your startup stack — AI, automation, support, analytics, monitoring, RAG, agents, backend, and error tracking — into one private command center running on redu.cloud.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition"
                >
                  Launch Demo
                </Link>
                <Link
                  href="/operator"
                  className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary-600 font-medium rounded-lg border border-gray-300 hover:border-primary-600 hover:bg-primary-50 transition"
                >
                  View AI Operator
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-24 bg-gray-50 border-t border-gray-200">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
              Startups need a command center.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl mb-4">
                  📊
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Fragmented Stack</h3>
                <p className="text-gray-600">
                  Your startup uses 10+ tools. None talk to each other. You spend time switching tabs instead of building.
                </p>
              </div>
              <div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-2xl mb-4">
                  🚨
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Missed Signals</h3>
                <p className="text-gray-600">
                  Errors in GlitchTip, support issues in Zammad, analytics in Umami. You miss the full picture.
                </p>
              </div>
              <div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl mb-4">
                  ⏰
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Manual Work</h3>
                <p className="text-gray-600">
                  Summarizing metrics, prioritizing issues, drafting updates. Repetitive work AI should handle.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
              How reduOS works.
            </h2>
            <p className="text-center text-gray-600 mb-12 text-lg">
              One dashboard, one AI operator, one view of your entire startup.
            </p>
            <div className="space-y-12">
              <div className="flex gap-8 items-start">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-primary-600">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Stack</h3>
                  <p className="text-gray-600">
                    Link Listmonk, Zammad, Umami, Uptime Kuma, Qdrant, and other tools. reduOS ingests events from all of them.
                  </p>
                </div>
              </div>
              <div className="flex gap-8 items-start">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-primary-600">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">See Your Startup in Real-Time</h3>
                  <p className="text-gray-600">
                    Dashboard shows new users, support tickets, errors, uptime, conversion rates, and everything else in one view. Updated every minute.
                  </p>
                </div>
              </div>
              <div className="flex gap-8 items-start">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-primary-600">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Ask Your AI Operator</h3>
                  <p className="text-gray-600">
                    Ask "What happened today?" "What should I fix first?" "Why are users not converting?" The AI synthesizes all your data and gives you answers.
                  </p>
                </div>
              </div>
              <div className="flex gap-8 items-start">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-primary-600">
                  4
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Automated Recommendations</h3>
                  <p className="text-gray-600">
                    reduOS suggests actions: improve docs, send follow-up emails, create support tickets, investigate errors. Built on your data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Startup Stack */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-24 bg-gray-50 border-t border-gray-200">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
              Open-source startup stack.
            </h2>
            <p className="text-center text-gray-600 mb-12 text-lg">
              reduOS is built on and integrates with leading open-source tools.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { emoji: '📧', name: 'Listmonk', desc: 'Waitlist & newsletter' },
                { emoji: '🤖', name: 'Ollama + DeepSeek', desc: 'Local AI models' },
                { emoji: '⚡', name: 'Activepieces', desc: 'Automation flows' },
                { emoji: '💬', name: 'Zammad', desc: 'AI support tickets' },
                { emoji: '📊', name: 'Umami', desc: 'Analytics' },
                { emoji: '📈', name: 'Uptime Kuka', desc: 'Monitoring' },
                { emoji: '🗄️', name: 'Qdrant', desc: 'Vector database' },
                { emoji: '🕷️', name: 'Firecrawl', desc: 'Web crawler' },
                { emoji: '🔗', name: 'Flowise', desc: 'RAG & agents' },
                { emoji: '🔍', name: 'Langfuse', desc: 'LLM observability' },
                { emoji: '🔧', name: 'Appwrite', desc: 'Backend-as-a-service' },
                { emoji: '🔴', name: 'GlitchTip', desc: 'Error tracking' },
              ].map((tool, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{tool.emoji}</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">{tool.name}</h4>
                      <p className="text-sm text-gray-600">{tool.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Command Center Preview */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
              Your command center.
            </h2>
            <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-xl border border-primary-200 p-8 md:p-12">
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-primary-600 uppercase mb-2">Daily Briefing</p>
                  <p className="text-xl font-bold text-gray-900">
                    Today your startup gained 24 new waitlist users, 3 users reported onboarding confusion, the API had one short outage, and the most important next action is improving the getting-started flow.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'New Users', value: '24', change: '+18%' },
                    { label: 'Waitlist', value: '156', change: '+12%' },
                    { label: 'Support Tickets', value: '8', change: '+2' },
                    { label: 'Uptime', value: '99.98%', change: 'Perfect' },
                  ].map((metric, i) => (
                    <div key={i} className="bg-white rounded-lg p-4 border border-primary-200">
                      <p className="text-xs text-gray-600 mb-1">{metric.label}</p>
                      <p className="text-lg font-bold text-gray-900">{metric.value}</p>
                      <p className="text-xs text-green-600 mt-1">{metric.change}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations CTA */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-24 bg-gray-50 border-t border-gray-200">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Ready to run your startup smarter?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Launch the reduOS demo. No signup required. Explore all the features.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-8 py-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition text-lg"
            >
              Launch reduOS →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
