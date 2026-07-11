create table public.micro_learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null,
  youtube_id text not null,
  timestamp_sec int not null,
  sub_concept text not null,
  sub_concept_term text,
  resources jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on public.micro_learning_events to authenticated;
grant all on public.micro_learning_events to service_role;

alter table public.micro_learning_events enable row level security;

create policy "micro_learning_events own read"
  on public.micro_learning_events for select
  to authenticated using (auth.uid() = user_id);

create policy "micro_learning_events own insert"
  on public.micro_learning_events for insert
  to authenticated with check (auth.uid() = user_id);

create index micro_learning_events_user_topic_idx
  on public.micro_learning_events (user_id, topic_id, created_at desc);

create index micro_learning_events_user_term_idx
  on public.micro_learning_events (user_id, sub_concept_term, created_at desc);