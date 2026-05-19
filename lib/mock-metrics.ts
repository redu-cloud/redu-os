import type { MetricCard } from '@/types';

export const mockMetrics: MetricCard[] = [
  {
    title: 'New Users',
    value: '24',
    change: '+18%',
    status: 'up',
  },
  {
    title: 'Waitlist Signups',
    value: '156',
    change: '+12%',
    status: 'up',
  },
  {
    title: 'Open Support Tickets',
    value: '8',
    change: '+2',
    status: 'neutral',
  },
  {
    title: 'High Priority Issues',
    value: '2',
    change: '-1',
    status: 'down',
  },
  {
    title: 'Conversion Rate',
    value: '3.2%',
    change: '+0.4%',
    status: 'up',
  },
  {
    title: 'Uptime',
    value: '99.98%',
    change: 'Perfect',
    status: 'up',
  },
  {
    title: 'App Errors',
    value: '3',
    change: '-5',
    status: 'down',
  },
  {
    title: 'AI Workflows Run',
    value: '142',
    change: '+32',
    status: 'up',
  },
];
