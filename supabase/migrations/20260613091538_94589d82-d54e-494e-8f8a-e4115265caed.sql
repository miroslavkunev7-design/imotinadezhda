
CREATE TABLE IF NOT EXISTS public.villages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oblast_slug TEXT NOT NULL,
  municipality_slug TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oblast_slug, slug)
);

CREATE INDEX IF NOT EXISTS villages_oblast_idx ON public.villages (oblast_slug);
CREATE INDEX IF NOT EXISTS villages_municipality_idx ON public.villages (municipality_slug);

GRANT SELECT ON public.villages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.villages TO authenticated;
GRANT ALL ON public.villages TO service_role;

ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Villages are viewable by everyone"
  ON public.villages FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert villages"
  ON public.villages FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update villages"
  ON public.villages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete villages"
  ON public.villages FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER villages_set_updated_at
  BEFORE UPDATE ON public.villages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
