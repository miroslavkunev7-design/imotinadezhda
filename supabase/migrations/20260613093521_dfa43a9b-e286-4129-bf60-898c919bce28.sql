ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS village_id uuid REFERENCES public.villages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_village ON public.properties(village_id);