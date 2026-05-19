import type { MetricCard as MetricCardType } from '@/types';

interface Props {
  metric: MetricCardType;
}

export function MetricCard({ metric }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 transition">
      <p className="text-sm text-gray-600 mb-2">{metric.title}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
          {metric.change && (
            <p
              className={`text-xs font-medium mt-2 ${
                metric.status === 'up'
                  ? 'text-green-600'
                  : metric.status === 'down'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}
            >
              {metric.status === 'up' ? '↑' : metric.status === 'down' ? '↓' : '→'} {metric.change}
            </p>
          )}
        </div>
        <div
          className={`w-2 h-2 rounded-full ${
            metric.status === 'up'
              ? 'bg-green-500'
              : metric.status === 'down'
                ? 'bg-orange-500'
                : 'bg-gray-300'
          }`}
        ></div>
      </div>
    </div>
  );
}
