-- Quarter images gallery
CREATE TABLE public.quarter_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quarter_id UUID NOT NULL REFERENCES public.quarters(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quarter_images_quarter ON public.quarter_images(quarter_id, display_order);

GRANT SELECT ON public.quarter_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarter_images TO authenticated;
GRANT ALL ON public.quarter_images TO service_role;

ALTER TABLE public.quarter_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quarter_images public read"
ON public.quarter_images FOR SELECT
USING (true);

CREATE POLICY "quarter_images admin all"
ON public.quarter_images FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Extracted listings (scraper drafts)
CREATE TYPE public.extracted_status AS ENUM ('pending', 'approved', 'rejected', 'published');
CREATE TYPE public.extracted_source AS ENUM ('realistimo', 'imoti_bg', 'olx', 'bazar_bg', 'home_bg', 'alo_bg', 'facebook', 'other');
CREATE TYPE public.seller_type AS ENUM ('private', 'agency', 'unknown');

CREATE TABLE public.extracted_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source extracted_source NOT NULL,
  source_url TEXT NOT NULL,
  external_id TEXT,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  quarter_id UUID REFERENCES public.quarters(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'EUR',
  area_sqm NUMERIC,
  rooms INTEGER,
  bedrooms INTEGER,
  property_type TEXT,
  seller_type seller_type NOT NULL DEFAULT 'unknown',
  contact_name TEXT,
  phone TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_data JSONB,
  status extracted_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  published_property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_extracted_source_url ON public.extracted_listings(source, source_url);
CREATE INDEX idx_extracted_status ON public.extracted_listings(status, scraped_at DESC);
CREATE INDEX idx_extracted_city ON public.extracted_listings(city_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracted_listings TO authenticated;
GRANT ALL ON public.extracted_listings TO service_role;

ALTER TABLE public.extracted_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extracted_listings admin all"
ON public.extracted_listings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_extracted_updated_at
BEFORE UPDATE ON public.extracted_listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();