import type { RecommendedAction } from '@/types';

interface Props {
  action: RecommendedAction;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-50 border-red-200',
  medium: 'bg-yellow-50 border-yellow-200',
  low: 'bg-blue-50 border-blue-200',
};

const priorityBadges: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const statusIcons: Record<string, string> = {
  suggested: '💡',
  accepted: '✅',
  done: '🎉',
};

const statusColors: Record<string, string> = {
  suggested: 'text-gray-600',
  accepted: 'text-blue-600',
  done: 'text-green-600',
};

export function ActionCard({ action }: Props) {
  return (
    <div className={`rounded-lg border p-6 ${priorityColors[action.priority]}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{action.title}</h3>
          <p className="text-sm text-gray-600 mt-2">{action.reason}</p>
        </div>
        <span className={`text-2xl ${statusColors[action.status]}`}>{statusIcons[action.status]}</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-medium px-2 py-1 rounded ${priorityBadges[action.priority]}`}>
          {action.priority}
        </span>
        {action.suggestedOwner && (
          <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
            Owner: {action.suggestedOwner}
          </span>
        )}
        {action.relatedIntegration && (
          <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
            {action.relatedIntegration}
          </span>
        )}
        {action.estimatedTime && (
          <span className="text-xs text-gray-500 ml-auto">{action.estimatedTime}</span>
        )}
      </div>
    </div>
  );
}
