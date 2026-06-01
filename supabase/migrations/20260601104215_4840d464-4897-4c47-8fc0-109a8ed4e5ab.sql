ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deal_stage text,
  ADD COLUMN IF NOT EXISTS deal_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS mortgage_data jsonb NOT NULL DEFAULT '{}'::jsonb;