-- Депозит и харесан имот за клиент (задача 5).
-- Само добавя колони — не променя съществуващи данни.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deposit_amount   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS deposit_currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS deposit_date     DATE,
  ADD COLUMN IF NOT EXISTS deposit_method   TEXT,
  ADD COLUMN IF NOT EXISTS deposit_status   TEXT,
  ADD COLUMN IF NOT EXISTS deposit_note     TEXT,
  ADD COLUMN IF NOT EXISTS interest_property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interest_note    TEXT;

CREATE INDEX IF NOT EXISTS clients_interest_property_id_idx
  ON public.clients (interest_property_id);
