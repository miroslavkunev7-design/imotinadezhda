-- Idempotent creation of any core tables that may be missing from the
-- Supabase database. Existing tables are NOT modified — `CREATE TABLE IF NOT
-- EXISTS` skips them entirely, and GRANT / RLS / POLICY statements are safe
-- to re-run. Apply in Supabase SQL Editor.
--
-- Covers the tables listed on /admin/schema that are foundational to the app:
--   profiles, user_roles (+ app_role enum + has_role fn), cities, quarters,
--   properties, clients, inquiries.
--
-- The following tables have dedicated migrations and are NOT included here:
--   tasks, contracts, audit_log       → 20260715120000_missing_tables.sql
--   rentals, rental_payments          → 20260713120000_rentals_and_payments.sql

-- ============ app_role enum + has_role() (required by RLS policies) ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'broker', 'user');
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ profiles ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles admin all" ON public.profiles;
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ user_roles ============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "user_roles admin all" ON public.user_roles;
CREATE POLICY "user_roles admin all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ cities ============
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cities public read" ON public.cities;
CREATE POLICY "cities public read" ON public.cities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "cities admin all" ON public.cities;
CREATE POLICY "cities admin all" ON public.cities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ quarters ============
CREATE TABLE IF NOT EXISTS public.quarters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city_id, name)
);
GRANT SELECT ON public.quarters TO anon, authenticated;
GRANT ALL ON public.quarters TO service_role;
ALTER TABLE public.quarters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quarters public read" ON public.quarters;
CREATE POLICY "quarters public read" ON public.quarters FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "quarters admin all" ON public.quarters;
CREATE POLICY "quarters admin all" ON public.quarters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX IF NOT EXISTS idx_quarters_city_id ON public.quarters(city_id);

-- ============ properties ============
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  area_sqm NUMERIC(10,2),
  rooms INTEGER,
  floor INTEGER,
  property_type TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'sale',
  status TEXT NOT NULL DEFAULT 'active',
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  quarter_id UUID REFERENCES public.quarters(id) ON DELETE SET NULL,
  address TEXT,
  cover_url TEXT,
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON public.properties TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "properties public read active" ON public.properties;
CREATE POLICY "properties public read active" ON public.properties FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "properties admin all" ON public.properties;
CREATE POLICY "properties admin all" ON public.properties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX IF NOT EXISTS idx_properties_city_id ON public.properties(city_id);
CREATE INDEX IF NOT EXISTS idx_properties_quarter_id ON public.properties(quarter_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);

-- ============ clients ============
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  client_type TEXT NOT NULL DEFAULT 'buyer',
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients admin all" ON public.clients;
CREATE POLICY "clients admin all" ON public.clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "clients broker assigned read" ON public.clients;
CREATE POLICY "clients broker assigned read" ON public.clients FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON public.clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_client_type ON public.clients(client_type);

-- ============ inquiries ============
CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT INSERT ON public.inquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inquiries public insert" ON public.inquiries;
CREATE POLICY "inquiries public insert" ON public.inquiries FOR INSERT TO anon, authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS "inquiries admin all" ON public.inquiries;
CREATE POLICY "inquiries admin all" ON public.inquiries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON public.inquiries(property_id);

-- Refresh PostgREST schema cache so new tables/columns are visible immediately.
NOTIFY pgrst, 'reload schema';