-- Soft-delete for incidents
alter table incidents add column if not exists is_deleted boolean not null default false;
alter table incidents add column if not exists deleted_at timestamptz;
alter table incidents add column if not exists deleted_by uuid references users(id);

-- Index for fast filtering
create index if not exists idx_incidents_is_deleted on incidents(is_deleted);
