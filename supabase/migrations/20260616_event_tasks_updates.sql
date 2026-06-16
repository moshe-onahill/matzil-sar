-- Event updates (mirrors incident_updates structure)
create table if not exists public.event_updates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  update_type text not null default 'General Update',
  title text not null,
  body text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Event tasks (simplified — no unit assignments for training)
create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  task_number text not null,
  description text,
  status text not null default 'Pending',
  assignee_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.event_updates enable row level security;
alter table public.event_tasks enable row level security;

-- Authenticated users can read
create policy "event_updates_read" on public.event_updates
  for select using (auth.role() = 'authenticated');

create policy "event_tasks_read" on public.event_tasks
  for select using (auth.role() = 'authenticated');

-- Authenticated users can insert
create policy "event_updates_insert" on public.event_updates
  for insert with check (auth.role() = 'authenticated');

create policy "event_tasks_insert" on public.event_tasks
  for insert with check (auth.role() = 'authenticated');

-- Authenticated users can update/delete (admin check in app layer)
create policy "event_updates_modify" on public.event_updates
  for all using (auth.role() = 'authenticated');

create policy "event_tasks_modify" on public.event_tasks
  for all using (auth.role() = 'authenticated');
