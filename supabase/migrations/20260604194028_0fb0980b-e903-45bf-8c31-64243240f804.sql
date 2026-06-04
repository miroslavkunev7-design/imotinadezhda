
-- Groups (Банки, Строители, Нотариуси, Клиенти, Партньори, ...)
CREATE TABLE public.contact_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_groups TO authenticated;
GRANT ALL ON public.contact_groups TO service_role;

ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_groups admin all" ON public.contact_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER contact_groups_updated_at
  BEFORE UPDATE ON public.contact_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contacts/Companies
CREATE TABLE public.contact_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.contact_groups(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_person text,
  role text,
  phone text,
  email text,
  website text,
  address text,
  vat_number text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_entries_group_idx ON public.contact_entries(group_id);
CREATE INDEX contact_entries_email_idx ON public.contact_entries(email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_entries TO authenticated;
GRANT ALL ON public.contact_entries TO service_role;

ALTER TABLE public.contact_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_entries admin all" ON public.contact_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER contact_entries_updated_at
  BEFORE UPDATE ON public.contact_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default groups
INSERT INTO public.contact_groups (slug, name, icon, display_order) VALUES
  ('banks',      'Банки',      'Landmark',   1),
  ('builders',   'Строители',  'HardHat',    2),
  ('notaries',   'Нотариуси',  'Stamp',      3),
  ('clients',    'Клиенти',    'Users',      4),
  ('partners',   'Партньори',  'Handshake',  5);
