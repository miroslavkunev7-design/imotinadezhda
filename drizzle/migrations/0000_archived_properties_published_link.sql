ALTER TABLE public.archived_properties
  ADD COLUMN IF NOT EXISTS published_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;