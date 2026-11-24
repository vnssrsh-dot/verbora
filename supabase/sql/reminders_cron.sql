-- Hourly call of the «reminders» Edge Function (pg_cron + pg_net).
-- Before running: replace PROJECT_REF and CRON_SECRET_VALUE (the same value as the CRON_SECRET
-- function secret). Run it once in the Supabase SQL editor.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'verbora-reminders',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object('x-cron-secret', 'CRON_SECRET_VALUE')
  );
  $$
);
