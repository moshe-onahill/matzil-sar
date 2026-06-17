-- Add logistics coordinator to incidents
alter table public.incidents
  add column if not exists coordinator_id uuid references public.users(id) on delete set null;
