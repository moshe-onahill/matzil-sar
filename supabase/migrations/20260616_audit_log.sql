create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  actor_id      uuid references users(id) on delete set null,
  actor_name    text,                 -- snapshot so it survives user deletion
  action        text not null,        -- e.g. 'approve_change_request', 'edit_member'
  entity_type   text,                 -- 'user', 'incident', 'event', ...
  entity_id     text,
  entity_label  text,                 -- human-readable snapshot
  details       jsonb                 -- any extra structured data
);

alter table audit_log enable row level security;

-- Global admins can read all entries
create policy "Global admins can read audit log"
  on audit_log for select
  using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'Global Admin'
    )
  );

-- Any authenticated user can insert (the app inserts on their behalf)
create policy "Authenticated users can insert audit entries"
  on audit_log for insert
  with check (auth.uid() is not null);
