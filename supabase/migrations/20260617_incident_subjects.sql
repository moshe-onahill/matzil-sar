create table if not exists public.incident_subjects (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id) on delete cascade not null,

  -- Identity
  full_name text,
  also_known_as text,
  date_of_birth date,
  age_estimate text,
  gender text,
  nationality text,

  -- Physical description
  height_cm integer,
  weight_kg integer,
  hair_color text,
  hair_length text,
  eye_color text,
  skin_tone text,
  build text,
  distinguishing_features text,

  -- Last known
  last_seen_wearing text,
  last_seen_location text,
  last_seen_at timestamptz,
  last_contact_at timestamptz,

  -- Medical / behavioral
  medical_conditions text,
  medications text,
  mental_health_notes text,
  mobility text,
  languages_spoken text,

  -- Photo
  photo_url text,

  -- Misc
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.incident_subjects enable row level security;

create policy "subjects_read" on public.incident_subjects
  for select using (auth.role() = 'authenticated');

create policy "subjects_write" on public.incident_subjects
  for all using (auth.role() = 'authenticated');

-- Storage bucket for subject photos (run separately if storage not yet configured)
-- insert into storage.buckets (id, name, public) values ('subject-photos', 'subject-photos', true)
-- on conflict do nothing;
