DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'viewings_property_id_fkey'
  ) THEN
    ALTER TABLE public.viewings
      ADD CONSTRAINT viewings_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS viewings_property_idx ON public.viewings (property_id);