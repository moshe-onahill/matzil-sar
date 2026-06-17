create table if not exists public.incident_staging_areas (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id) on delete cascade not null,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.incident_staging_areas enable row level security;

create policy "staging_read" on public.incident_staging_areas
  for select using (auth.role() = 'authenticated');

create policy "staging_write" on public.incident_staging_areas
  for all using (auth.role() = 'authenticated');
