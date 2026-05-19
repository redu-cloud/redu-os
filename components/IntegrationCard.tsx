import type { Integration } from '@/types';

interface Props {
  integration: Integration;
}

const statusBadges: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  not_connected: 'bg-gray-100 text-gray-700',
  demo_mode: 'bg-blue-100 text-blue-700',
};

const categoryEmojis: Record<string, string> = {
  ai: '🤖',
  analytics: '📊',
  support: '💬',
  monitoring: '📈',
  automation: '⚡',
  database: '🗄️',
  backend: '🔧',
  errors: '🔴',
  newsletter: '📧',
};

export function IntegrationCard({ integration }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${integration.color} rounded-lg flex items-center justify-center text-white text-xl`}>
            {categoryEmojis[integration.category] || '•'}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{integration.name}</h3>
            <p className="text-xs text-gray-500 capitalize">{integration.category}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${statusBadges[integration.status]}`}>
          {integration.status.replace('_', ' ')}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4">{integration.description}</p>

      <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
        <p className="font-medium mb-1">Example use:</p>
        <p className="text-gray-600">{integration.useCase}</p>
      </div>
    </div>
  );
}
