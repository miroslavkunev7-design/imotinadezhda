ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS yard_sqm numeric,
  ADD COLUMN IF NOT EXISTS built_up_area_sqm numeric,
  ADD COLUMN IF NOT EXISTS parking_spaces integer,
  ADD COLUMN IF NOT EXISTS has_garage boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS heating text,
  ADD COLUMN IF NOT EXISTS construction_type text,
  ADD COLUMN IF NOT EXISTS land_regulation text,
  ADD COLUMN IF NOT EXISTS office_class text;