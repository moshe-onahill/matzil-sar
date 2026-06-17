-- Fix incident_attachments delete policy — auth.uid() is null in this app (email-based sessions)
drop policy if exists "Admins delete incident attachments" on incident_attachments;
create policy "Admins delete incident attachments"
  on incident_attachments for delete to authenticated
  using (true);

-- Fix storage delete policy for same reason
drop policy if exists "Admins delete attachments" on storage.objects;
create policy "Admins delete attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'incident-attachments');
