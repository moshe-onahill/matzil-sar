-- Certification requests
create table if not exists certification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  cert_name text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists idx_cert_requests_user on certification_requests(user_id);
create index if not exists idx_cert_requests_status on certification_requests(status);
alter table certification_requests enable row level security;

drop policy if exists "Users see own cert requests" on certification_requests;
create policy "Users see own cert requests"
  on certification_requests for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id
    where u.id = auth.uid() and r.name in ('Global Admin','SAR Manager','Dispatcher')
  ));

drop policy if exists "Users insert own cert requests" on certification_requests;
create policy "Users insert own cert requests"
  on certification_requests for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins update cert requests" on certification_requests;
create policy "Admins update cert requests"
  on certification_requests for update to authenticated
  using (exists (
    select 1 from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id
    where u.id = auth.uid() and r.name in ('Global Admin','SAR Manager')
  ));

-- Vehicle service requests
create table if not exists vehicle_service_requests (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references agency_vehicles(id) on delete cascade,
  reported_by uuid references users(id),
  description text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  admin_note text,
  completed_by uuid references users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_vsr_vehicle on vehicle_service_requests(vehicle_id);
create index if not exists idx_vsr_status on vehicle_service_requests(status);
alter table vehicle_service_requests enable row level security;

drop policy if exists "All authenticated read service requests" on vehicle_service_requests;
create policy "All authenticated read service requests"
  on vehicle_service_requests for select to authenticated using (true);

drop policy if exists "All authenticated insert service requests" on vehicle_service_requests;
create policy "All authenticated insert service requests"
  on vehicle_service_requests for insert to authenticated with check (true);

drop policy if exists "Admins update service requests" on vehicle_service_requests;
create policy "Admins update service requests"
  on vehicle_service_requests for update to authenticated
  using (exists (
    select 1 from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id
    where u.id = auth.uid() and r.name in ('Global Admin','SAR Manager','Dispatcher')
  ));
