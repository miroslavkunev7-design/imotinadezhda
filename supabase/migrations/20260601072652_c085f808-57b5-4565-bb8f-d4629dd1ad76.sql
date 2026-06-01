
-- Архив на имоти (само админ): запазени от extracted_listings или ръчно
CREATE TABLE public.archived_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_extracted_id UUID,
  source_url TEXT,
  source TEXT,
  title TEXT NOT NULL,
  description TEXT,
  city_id UUID,
  quarter_id UUID,
  property_type TEXT,
  status TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'EUR',
  area_sqm NUMERIC,
  rooms INTEGER,
  bedrooms INTEGER,
  floor INTEGER,
  total_floors INTEGER,
  year_built INTEGER,
  address TEXT,
  contact_name TEXT,
  phone TEXT,
  seller_type TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_data JSONB,
  notes TEXT,
  drive_folder_path TEXT,
  drive_folder_id TEXT,
  drive_sync_status TEXT NOT NULL DEFAULT 'pending',
  archived_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  archived_by UUID,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_properties TO authenticated;
GRANT ALL ON public.archived_properties TO service_role;

ALTER TABLE public.archived_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archived_properties admin all"
ON public.archived_properties
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_archived_properties_city ON public.archived_properties(city_id);
CREATE INDEX idx_archived_properties_quarter ON public.archived_properties(quarter_id);
CREATE INDEX idx_archived_properties_year ON public.archived_properties(archived_year);

CREATE TRIGGER trg_archived_properties_updated
BEFORE UPDATE ON public.archived_properties
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
