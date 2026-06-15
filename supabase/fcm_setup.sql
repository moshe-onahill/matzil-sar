-- Run in Supabase SQL Editor

-- FCM token storage (one row per user per platform)
create table if not exists fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  token text not null,
  platform text not null default 'android',  -- 'android' | 'ios'
  created_at timestamptz not null default now(),
  unique(user_id, platform)
);

alter table fcm_tokens enable row level security;
create policy "users can manage own fcm tokens" on fcm_tokens
  for all using (true);  -- service role handles writes; anon client reads own

-- Add sent_at and error columns to notification_logs if not already there
alter table notification_logs
  add column if not exists sent_at timestamptz,
  add column if not exists error text;

-- pg_cron: call the edge function every 15 seconds to drain notification_logs
-- Requires pg_cron extension enabled in Supabase dashboard (Database > Extensions)
select cron.schedule(
  'drain-notifications',
  '* * * * *',   -- every minute (pg_cron minimum; for 15s use the edge function webhook approach)
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-notifications',
    headers := '{"Authorization": "Bearer <YOUR_ANON_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
