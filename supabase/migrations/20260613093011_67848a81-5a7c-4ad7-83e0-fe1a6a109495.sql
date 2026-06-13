ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC;

UPDATE public.cities SET lat = 43.2706, lng = 26.9229 WHERE slug = 'shumen';
UPDATE public.cities SET lat = 43.2141, lng = 27.9147 WHERE slug = 'varna';
UPDATE public.cities SET lat = 42.5048, lng = 27.4626 WHERE slug = 'burgas';
UPDATE public.cities SET lat = 43.3494, lng = 27.2003 WHERE slug = 'novi-pazar';

ALTER TABLE public.villages
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC;

CREATE INDEX IF NOT EXISTS villages_oblast_distance_idx
  ON public.villages (oblast_slug, distance_km NULLS LAST, name);