create extension if not exists "uuid-ossp";

create table if not exists public.startup_events (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  source text not null,
  severity text not null default 'info',
  user_email text,
  user_name text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists startup_events_type_idx on public.startup_events (type);
create index if not exists startup_events_source_idx on public.startup_events (source);
create index if not exists startup_events_severity_idx on public.startup_events (severity);
create index if not exists startup_events_created_at_idx on public.startup_events (created_at desc);
create index if not exists startup_events_metadata_gin_idx on public.startup_events using gin (metadata);

create table if not exists public.ai_insights (
  id uuid primary key default uuid_generate_v4(),
  startup_event_id uuid references public.startup_events(id) on delete cascade,
  category text not null,
  priority text not null default 'Medium',
  sentiment text not null default 'Neutral',
  summary text,
  recommended_action text,
  ai_model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_insights_event_idx on public.ai_insights (startup_event_id);
create index if not exists ai_insights_category_idx on public.ai_insights (category);
create index if not exists ai_insights_priority_idx on public.ai_insights (priority);
create index if not exists ai_insights_created_at_idx on public.ai_insights (created_at desc);

create table if not exists public.ai_actions (
  id uuid primary key default uuid_generate_v4(),
  startup_event_id uuid references public.startup_events(id) on delete cascade,
  ai_insight_id uuid references public.ai_insights(id) on delete set null,
  action_type text not null,
  status text not null default 'pending',
  target text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_actions_event_idx on public.ai_actions (startup_event_id);
create index if not exists ai_actions_insight_idx on public.ai_actions (ai_insight_id);
create index if not exists ai_actions_action_type_idx on public.ai_actions (action_type);
create index if not exists ai_actions_status_idx on public.ai_actions (status);
create index if not exists ai_actions_created_at_idx on public.ai_actions (created_at desc);

create table if not exists public.ai_feedback (
  id uuid primary key default uuid_generate_v4(),
  startup_event_id uuid references public.startup_events(id) on delete cascade,
  ai_action_id uuid references public.ai_actions(id) on delete set null,
  feedback_type text not null,
  score integer,
  result text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_feedback_event_idx on public.ai_feedback (startup_event_id);
create index if not exists ai_feedback_action_idx on public.ai_feedback (ai_action_id);
create index if not exists ai_feedback_feedback_type_idx on public.ai_feedback (feedback_type);
create index if not exists ai_feedback_result_idx on public.ai_feedback (result);
create index if not exists ai_feedback_created_at_idx on public.ai_feedback (created_at desc);

alter table public.startup_events enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_actions enable row level security;
alter table public.ai_feedback enable row level security;

drop policy if exists "Service role can manage startup events" on public.startup_events;
create policy "Service role can manage startup events"
on public.startup_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage AI insights" on public.ai_insights;
create policy "Service role can manage AI insights"
on public.ai_insights
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage AI actions" on public.ai_actions;
create policy "Service role can manage AI actions"
on public.ai_actions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage AI feedback" on public.ai_feedback;
create policy "Service role can manage AI feedback"
on public.ai_feedback
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
