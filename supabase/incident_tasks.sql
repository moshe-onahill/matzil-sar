-- Run this in the Supabase SQL editor

create table if not exists incident_tasks (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references incidents(id) on delete cascade not null,
  task_number text not null,         -- e.g. "T-1", "T-2"
  description text,
  task_lead_id uuid references users(id) on delete set null,
  status text not null default 'Active',  -- Active | Completed | Suspended
  created_at timestamptz not null default now()
);

create table if not exists task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references incident_tasks(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  assigned_at timestamptz not null default now(),
  unique(task_id, user_id)
);

-- Allow authenticated reads and service-role writes
alter table incident_tasks enable row level security;
alter table task_assignments enable row level security;

create policy "read incident_tasks" on incident_tasks for select using (true);
create policy "read task_assignments" on task_assignments for select using (true);
