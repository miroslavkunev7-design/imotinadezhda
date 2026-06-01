CREATE TABLE public.owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  id_number TEXT,
  address TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners admin all" ON public.owners
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional link from properties to an owner
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties(owner_id);