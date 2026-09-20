CREATE TABLE public.bank_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank text NOT NULL,
  city_slug text NOT NULL,
  branch_label text,
  color text,
  image_url text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bank_branches_bank_city_uidx ON public.bank_branches (bank, city_slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_branches TO authenticated;
GRANT ALL ON public.bank_branches TO service_role;
ALTER TABLE public.bank_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_branches_staff_all ON public.bank_branches
  FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid()))
  WITH CHECK (public.is_crm_staff(auth.uid()));

CREATE TABLE public.bank_branch_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank text NOT NULL,
  city_slug text NOT NULL,
  rate_bg numeric(5,2) NOT NULL,
  rate_foreign numeric(5,2) NOT NULL,
  valid_from date NOT NULL,
  source text NOT NULL DEFAULT 'announced',
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bank_branch_rates_uidx ON public.bank_branch_rates (bank, city_slug, valid_from);
CREATE INDEX bank_branch_rates_city_idx ON public.bank_branch_rates (city_slug, valid_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_branch_rates TO authenticated;
GRANT ALL ON public.bank_branch_rates TO service_role;
ALTER TABLE public.bank_branch_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_branch_rates_staff_all ON public.bank_branch_rates
  FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid()))
  WITH CHECK (public.is_crm_staff(auth.uid()));

CREATE TRIGGER bank_branches_set_updated_at BEFORE UPDATE ON public.bank_branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bank_branch_rates_set_updated_at BEFORE UPDATE ON public.bank_branch_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();