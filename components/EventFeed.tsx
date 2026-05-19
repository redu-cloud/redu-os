import type { StartupEvent } from '@/types';

interface Props {
  events: StartupEvent[];
  limit?: number;
}

const typeEmojis: Record<string, string> = {
  signup: '👤',
  support: '💬',
  analytics: '📊',
  uptime: '🟢',
  error: '🔴',
  ai: '🤖',
  rag: '📚',
  automation: '⚡',
};

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

export function EventFeed({ events, limit }: Props) {
  const displayedEvents = limit ? events.slice(0, limit) : events;

  return (
    <div className="space-y-3">
      {displayedEvents.map((event) => (
        <div key={event.id} className={`rounded-lg border p-4 ${priorityColors[event.priority]}`}>
          <div className="flex items-start gap-3">
            <span className="text-xl">{typeEmojis[event.type] || '📌'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{event.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{event.message}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${priorityBadges[event.priority]}`}>
                  {event.priority}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <span>{event.source}</span>
                <span>•</span>
                <span>{formatTime(event.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = (now.getTime() - date.getTime()) / 1000;

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
