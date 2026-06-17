-- Add pin_type to custom_pins
alter table custom_pins add column if not exists pin_type text not null default 'location'
  check (pin_type in ('vehicle', 'location', 'other'));
