-- AI асистент 24/7: канали, лийдове, хендоф, CRM достъп

ALTER TABLE public.customer_chats
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'site',
  ADD COLUMN IF NOT EXISTS external_user_id text,
  ADD COLUMN IF NOT EXISTS visitor_budget numeric,
  ADD COLUMN IF NOT EXISTS visitor_city text,
  ADD COLUMN IF NOT EXISTS lead_captured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inquiry_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS unanswered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS handoff_reason text;

CREATE INDEX IF NOT EXISTS customer_chats_channel_idx ON public.customer_chats (channel);
CREATE INDEX IF NOT EXISTS customer_chats_unanswered_idx ON public.customer_chats (unanswered) WHERE unanswered = true;
CREATE UNIQUE INDEX IF NOT EXISTS customer_chats_channel_external_uidx
  ON public.customer_chats (channel, external_user_id)
  WHERE external_user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_chats_inquiry_id_fkey'
  ) THEN
    ALTER TABLE public.customer_chats
      ADD CONSTRAINT customer_chats_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_chats_client_id_fkey'
  ) THEN
    ALTER TABLE public.customer_chats
      ADD CONSTRAINT customer_chats_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;
