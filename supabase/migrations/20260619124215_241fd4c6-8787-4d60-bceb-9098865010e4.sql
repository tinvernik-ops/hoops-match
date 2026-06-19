
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('hoops-court-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hoops-court-alerts');

SELECT cron.schedule(
  'hoops-court-alerts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fmxlfweedredlgpgqufs.supabase.co/functions/v1/court-alerts',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
