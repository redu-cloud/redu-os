import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ActionCard } from '@/components/ActionCard';
import { mockActions } from '@/lib/mock-actions';

export default function Actions() {
  const suggestedActions = mockActions.filter((a) => a.status === 'suggested');
  const acceptedActions = mockActions.filter((a) => a.status === 'accepted');
  const completedActions = mockActions.filter((a) => a.status === 'done');

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900">Recommended Actions</h1>
            <p className="text-gray-600 mt-2">
              AI-suggested actions to improve your startup. Prioritized by impact.
            </p>
          </div>

          {/* Suggested */}
          {suggestedActions.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">💡 Suggested ({suggestedActions.length})</h2>
              <div className="space-y-4">
                {suggestedActions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            </div>
          )}

          {/* Accepted */}
          {acceptedActions.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">✅ In Progress ({acceptedActions.length})</h2>
              <div className="space-y-4">
                {acceptedActions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedActions.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🎉 Completed ({completedActions.length})</h2>
              <div className="space-y-4">
                {completedActions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="font-semibold text-gray-900 mb-2">AI Analysis</h3>
              <p className="text-sm text-gray-600">
                AI analyzes all your data: support tickets, errors, metrics, user behavior.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">💭</div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Recommendations</h3>
              <p className="text-sm text-gray-600">
                Suggests high-impact actions ranked by priority and estimated time.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-semibold text-gray-900 mb-2">Take Action</h3>
              <p className="text-sm text-gray-600">
                Track progress from suggested → accepted → completed.
              </p>
            </div>
          </div>

          {/* Priority Guide */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h3 className="font-bold text-gray-900 mb-6">Priority Guide</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-1 bg-red-500 flex-shrink-0"></div>
                <div>
                  <p className="font-semibold text-gray-900">🔴 High Priority</p>
                  <p className="text-sm text-gray-600">
                    Directly blocking conversions or causing user issues. Do this first.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-1 bg-yellow-500 flex-shrink-0"></div>
                <div>
                  <p className="font-semibold text-gray-900">🟡 Medium Priority</p>
                  <p className="text-sm text-gray-600">
                    Important for growth but not immediate blockers. Plan this week.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-1 bg-blue-500 flex-shrink-0"></div>
                <div>
                  <p className="font-semibold text-gray-900">🟢 Low Priority</p>
                  <p className="text-sm text-gray-600">
                    Nice to have. Work on when high/medium items are done.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Ask Operator */}
          <div className="mt-12 bg-primary-50 rounded-lg border border-primary-200 p-8 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Need more ideas?</h3>
            <p className="text-gray-600 mb-6">
              Ask your AI Operator what you should work on next.
            </p>
            <a
              href="/operator"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition"
            >
              Chat with AI Operator →
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
