-- Add sender display fields to notification_logs
alter table notification_logs
  add column if not exists sender_name text,
  add column if not exists sender_unit text;
