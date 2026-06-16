create table if not exists profile_change_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  field_name    text not null,        -- 'full_name' | 'call_sign'
  old_value     text,
  new_value     text not null,
  status        text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  admin_note    text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references users(id)
);

alter table profile_change_requests enable row level security;

-- Users can insert their own requests and read their own
create policy "Users can submit own change requests"
  on profile_change_requests for insert
  with check (user_id = auth.uid());

create policy "Users can view own change requests"
  on profile_change_requests for select
  using (user_id = auth.uid());

-- Admins (SAR Manager / Global Admin) can read and update all requests
create policy "Admins can view all change requests"
  on profile_change_requests for select
  using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name in ('SAR Manager', 'Global Admin')
    )
  );

create policy "Admins can update change requests"
  on profile_change_requests for update
  using (
    exists (
      select 1 from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name in ('SAR Manager', 'Global Admin')
    )
  );
