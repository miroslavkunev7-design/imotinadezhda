CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old schedule if re-running
DO $$ BEGIN
  PERFORM cron.unschedule('imoti-task-reminders');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'imoti-task-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--96d88938-791e-487e-8256-6bfbd8c8aa0f.lovable.app/api/public/hooks/task-reminders',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjcnp4Z3p5cHRxaWJzYWpvZWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDgwMjMsImV4cCI6MjA5NTgyNDAyM30.jHsY0umR0xZi0AKT9nNWAB34hRh84VrgjkIt52CuLo8"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);