export type MetricCard = {
  title: string;
  value: string | number;
  change?: string;
  status?: 'up' | 'down' | 'neutral';
  icon?: string;
};

export type StartupEvent = {
  id: string;
  type: 'signup' | 'support' | 'analytics' | 'uptime' | 'error' | 'ai' | 'rag' | 'automation';
  source: 'listmonk' | 'zammad' | 'umami' | 'uptime-kuma' | 'glitchtip' | 'activepieces' | 'flowise' | 'custom';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  metadata?: Record<string, any>;
};

export type Integration = {
  id: string;
  name: string;
  category: 'ai' | 'analytics' | 'support' | 'monitoring' | 'automation' | 'database' | 'backend' | 'errors' | 'newsletter';
  status: 'connected' | 'not_connected' | 'demo_mode';
  description: string;
  useCase: string;
  icon?: string;
  color?: string;
};

export type RecommendedAction = {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  reason: string;
  suggestedOwner?: string;
  relatedIntegration?: string;
  status: 'suggested' | 'accepted' | 'done';
  estimatedTime?: string;
};

export type AIBriefing = {
  summary: string;
  keyEvents: string[];
  topIssue: string;
  recommendation: string;
  nextAction: string;
};

export type OperatorResponse = {
  response: string;
  suggestedActions?: string[];
  relatedIntegrations?: string[];
  timestamp: string;
};
