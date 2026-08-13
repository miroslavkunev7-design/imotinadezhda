ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

COMMENT ON COLUMN public.properties.lat IS 'Географска ширина за картата на квартала';
COMMENT ON COLUMN public.properties.lng IS 'Географска дължина за картата на квартала';
