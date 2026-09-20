CREATE TABLE IF NOT EXISTS public.city_local_taxes (
  city_slug text PRIMARY KEY,
  local_tax_rate numeric(5,2) NOT NULL,
  source text NOT NULL DEFAULT 'ordinance',
  note text,
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.city_local_taxes TO authenticated;
GRANT ALL ON public.city_local_taxes TO service_role;

ALTER TABLE public.city_local_taxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "city_local_taxes_staff" ON public.city_local_taxes;
CREATE POLICY "city_local_taxes_staff"
ON public.city_local_taxes
FOR ALL
TO authenticated
USING (public.is_crm_staff(auth.uid()))
WITH CHECK (public.is_crm_staff(auth.uid()));

DROP TRIGGER IF EXISTS city_local_taxes_set_updated_at ON public.city_local_taxes;
CREATE TRIGGER city_local_taxes_set_updated_at
BEFORE UPDATE ON public.city_local_taxes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.city_local_taxes (city_slug, local_tax_rate, source, note, updated_by_name)
VALUES
  ('shumen', 3.00, 'ordinance', 'Наредба за местните данъци — Община Шумен', 'Обявена ставка'),
  ('varna', 3.00, 'ordinance', 'Наредба за местните данъци — Община Варна', 'Обявена ставка'),
  ('burgas', 3.00, 'ordinance', 'Наредба за местните данъци — Община Бургас', 'Обявена ставка')
ON CONFLICT (city_slug) DO NOTHING;