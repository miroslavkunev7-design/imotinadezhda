-- Автоматично дневно обновяване на лихвите: източници по банка + журнал на извличанията.

CREATE TABLE IF NOT EXISTS public.bank_rate_sources (
  bank text PRIMARY KEY,
  url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_rate_sources TO authenticated;
GRANT ALL ON public.bank_rate_sources TO service_role;

ALTER TABLE public.bank_rate_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_rate_sources_staff_all" ON public.bank_rate_sources;
CREATE POLICY "bank_rate_sources_staff_all"
ON public.bank_rate_sources
FOR ALL
TO authenticated
USING (public.is_crm_staff(auth.uid()))
WITH CHECK (public.is_crm_staff(auth.uid()));

DROP TRIGGER IF EXISTS bank_rate_sources_set_updated_at ON public.bank_rate_sources;
CREATE TRIGGER bank_rate_sources_set_updated_at
BEFORE UPDATE ON public.bank_rate_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.bank_rate_fetch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank text NOT NULL,
  url text,
  ok boolean NOT NULL DEFAULT false,
  rate_bg numeric(5,2),
  rate_foreign numeric(5,2),
  cities_updated integer NOT NULL DEFAULT 0,
  skipped_manual integer NOT NULL DEFAULT 0,
  error text,
  excerpt text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_rate_fetch_log_bank_time_idx
  ON public.bank_rate_fetch_log (bank, fetched_at DESC);

GRANT SELECT ON public.bank_rate_fetch_log TO authenticated;
GRANT ALL ON public.bank_rate_fetch_log TO service_role;

ALTER TABLE public.bank_rate_fetch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_rate_fetch_log_staff_read" ON public.bank_rate_fetch_log;
CREATE POLICY "bank_rate_fetch_log_staff_read"
ON public.bank_rate_fetch_log
FOR SELECT
TO authenticated
USING (public.is_crm_staff(auth.uid()));

INSERT INTO public.bank_rate_sources (bank, url, note) VALUES
  ('Банка ДСК', 'https://dskbank.bg/индивидуални-клиенти/кредити/жилищни-и-ипотечни-кредити', 'Официална страница жилищни кредити'),
  ('ОББ', 'https://www.ubb.bg/individual-clients/loans/mortgage-loans', 'Официална страница ипотечни кредити'),
  ('УниКредит Булбанк', 'https://www.unicreditbulbank.bg/bg/individualni-klienti/krediti/ipotechni-krediti/', 'Официална страница ипотечни кредити'),
  ('Fibank', 'https://www.fibank.bg/bg/jilishtni-i-ipotechni-krediti', 'Официална страница жилищни кредити'),
  ('Пощенска банка', 'https://www.postbank.bg/Individual-clients/Loans/Mortgage-loans', 'Официална страница ипотечни кредити'),
  ('Алианц Банк', 'https://bank.allianz.bg/bg/chastni-klienti/krediti/ipotechni-krediti/', 'Официална страница ипотечни кредити'),
  ('ЦКБ', 'https://www.ccbank.bg/bg/chastni-klienti/krediti/ipotechni-krediti', 'Официална страница ипотечни кредити'),
  ('TBI Bank', 'https://tbibank.bg/credits', 'Официална страница кредити'),
  ('Инвестбанк', 'https://ibank.bg/individualni-klienti/krediti/ipotechni-krediti/', 'Официална страница ипотечни кредити')
ON CONFLICT (bank) DO NOTHING;