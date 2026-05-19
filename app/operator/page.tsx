import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { OperatorChat } from '@/components/OperatorChat';

export default function Operator() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">AI Operator</h1>
            <p className="text-gray-600 mt-2">
              Your intelligent startup assistant. Ask anything about your business.
            </p>
          </div>

          {/* Chat */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6" style={{ minHeight: '600px' }}>
            <OperatorChat />
          </div>

          {/* Info */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold text-gray-900 mb-2">Daily Insights</h3>
              <p className="text-sm text-gray-600">
                Get a briefing of what happened in your startup today with AI analysis.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">💡</div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Recommendations</h3>
              <p className="text-sm text-gray-600">
                Receive AI-powered suggestions to improve your product and grow faster.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-semibold text-gray-900 mb-2">Automated Actions</h3>
              <p className="text-sm text-gray-600">
                Create tickets, send emails, and manage your startup without leaving reduOS.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
