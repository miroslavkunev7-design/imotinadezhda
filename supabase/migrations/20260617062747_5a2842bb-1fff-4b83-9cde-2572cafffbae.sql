CREATE TABLE IF NOT EXISTS public.agency_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  commission_rate numeric(5,4) NOT NULL DEFAULT 0.03,
  rent_commission_rate numeric(5,4) NOT NULL DEFAULT 0.50,
  vat_rate numeric(5,4) NOT NULL DEFAULT 0.20,
  default_currency text NOT NULL DEFAULT 'EUR',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agency_settings TO authenticated;
GRANT ALL ON public.agency_settings TO service_role;
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read agency settings" ON public.agency_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage agency settings" ON public.agency_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.agency_settings (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;