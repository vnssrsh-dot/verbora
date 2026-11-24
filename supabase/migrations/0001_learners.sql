-- VERBORA learners: one row per Telegram account.
-- Only the Edge Functions (service role) read and write this table; RLS with no policies
-- keeps it closed to the public anon key.
create table if not exists public.learners (
  tg_id            bigint primary key,
  first_name       text,
  lang             text not null default 'ua',
  state            jsonb,                      -- the app's progress (same shape as localStorage)
  state_saved_at   bigint not null default 0,  -- client timestamp (ms) of that state
  last_active_date date,                       -- learner's local date of the last activity
  tz_offset_min    integer not null default 0, -- minutes to add to UTC to get local time
  reminders        boolean not null default true,
  can_message      boolean not null default false, -- the learner has started the bot
  reminded_on      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.learners enable row level security;

create index if not exists learners_reminders_idx on public.learners (reminders, can_message);
