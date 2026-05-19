import type { AIBriefing } from '@/types';

interface Props {
  briefing: AIBriefing;
}

export function StartupPulseCard({ briefing }: Props) {
  return (
    <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-lg border border-primary-200 p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
            Daily Briefing
          </p>
          <h2 className="text-2xl font-bold text-gray-900">Startup Pulse</h2>
        </div>
        <div className="w-10 h-10 bg-white rounded-lg border border-primary-200 flex items-center justify-center text-primary-600 font-bold">
          🎯
        </div>
      </div>

      <p className="text-gray-900 font-medium mb-6 leading-relaxed">{briefing.summary}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Top Issue</p>
          <p className="text-gray-900 font-medium">{briefing.topIssue}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Recommendation</p>
          <p className="text-gray-900 font-medium">{briefing.recommendation}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Next Action</p>
        <p className="text-lg font-bold text-primary-600">{briefing.nextAction}</p>
      </div>
    </div>
  );
}
