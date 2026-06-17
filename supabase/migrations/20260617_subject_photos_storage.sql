-- Create subject-photos bucket (public read, authenticated upload)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subject-photos',
  'subject-photos',
  true,
  10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

-- Anyone can read (public bucket, needed for flyer)
drop policy if exists "subject_photos_public_read" on storage.objects;
create policy "subject_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'subject-photos');

-- Authenticated users can upload
drop policy if exists "subject_photos_auth_insert" on storage.objects;
create policy "subject_photos_auth_insert"
  on storage.objects for insert
  with check (bucket_id = 'subject-photos' and auth.role() = 'authenticated');

-- Authenticated users can update/replace their uploads
drop policy if exists "subject_photos_auth_update" on storage.objects;
create policy "subject_photos_auth_update"
  on storage.objects for update
  using (bucket_id = 'subject-photos' and auth.role() = 'authenticated');

-- Authenticated users can delete uploads
drop policy if exists "subject_photos_auth_delete" on storage.objects;
create policy "subject_photos_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'subject-photos' and auth.role() = 'authenticated');
