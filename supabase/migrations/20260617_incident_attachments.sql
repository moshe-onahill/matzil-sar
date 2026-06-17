-- Attachments storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-attachments',
  'incident-attachments',
  false,
  52428800,
  array['image/png','image/jpeg','image/jpg','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- Storage policies (drop first to allow re-running)
drop policy if exists "Admins upload attachments" on storage.objects;
create policy "Admins upload attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'incident-attachments'
    and exists (
      select 1 from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where u.id = auth.uid()
      and r.name in ('Global Admin', 'SAR Manager', 'Dispatcher')
    )
  );

drop policy if exists "Admins delete attachments" on storage.objects;
create policy "Admins delete attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'incident-attachments'
    and exists (
      select 1 from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where u.id = auth.uid()
      and r.name in ('Global Admin', 'SAR Manager', 'Dispatcher')
    )
  );

drop policy if exists "Members read attachments" on storage.objects;
create policy "Members read attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'incident-attachments');

-- Table
create table if not exists incident_attachments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_incident_attachments_incident on incident_attachments(incident_id);

alter table incident_attachments enable row level security;

drop policy if exists "All members read incident attachments" on incident_attachments;
create policy "All members read incident attachments"
  on incident_attachments for select to authenticated using (true);

drop policy if exists "Admins insert incident attachments" on incident_attachments;
create policy "Admins insert incident attachments"
  on incident_attachments for insert to authenticated
  with check (
    exists (
      select 1 from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where u.id = auth.uid()
      and r.name in ('Global Admin', 'SAR Manager', 'Dispatcher')
    )
  );

drop policy if exists "Admins delete incident attachments" on incident_attachments;
create policy "Admins delete incident attachments"
  on incident_attachments for delete to authenticated
  using (
    exists (
      select 1 from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where u.id = auth.uid()
      and r.name in ('Global Admin', 'SAR Manager', 'Dispatcher')
    )
  );
