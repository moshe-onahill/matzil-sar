-- Store send audience on incident updates
alter table incident_updates add column if not exists audience text default 'all';

-- Jobs within incidents
create table if not exists incident_jobs (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_incident_jobs_incident on incident_jobs(incident_id);
alter table incident_jobs enable row level security;

drop policy if exists "All auth read incident_jobs" on incident_jobs;
create policy "All auth read incident_jobs" on incident_jobs for select to authenticated using (true);
drop policy if exists "Admins insert incident_jobs" on incident_jobs;
create policy "Admins insert incident_jobs" on incident_jobs for insert to authenticated with check (true);
drop policy if exists "Admins update incident_jobs" on incident_jobs;
create policy "Admins update incident_jobs" on incident_jobs for update to authenticated using (true);
drop policy if exists "Admins delete incident_jobs" on incident_jobs;
create policy "Admins delete incident_jobs" on incident_jobs for delete to authenticated using (true);

-- Link tasks to jobs
alter table incident_tasks add column if not exists job_id uuid references incident_jobs(id) on delete set null;

-- Event unit assignments
create table if not exists event_unit_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(event_id, user_id)
);
create index if not exists idx_event_units_event on event_unit_assignments(event_id);
alter table event_unit_assignments enable row level security;

drop policy if exists "All auth read event_units" on event_unit_assignments;
create policy "All auth read event_units" on event_unit_assignments for select to authenticated using (true);
drop policy if exists "Admins manage event_units" on event_unit_assignments;
create policy "Admins manage event_units" on event_unit_assignments for insert to authenticated with check (true);
drop policy if exists "Admins delete event_units" on event_unit_assignments;
create policy "Admins delete event_units" on event_unit_assignments for delete to authenticated using (true);
