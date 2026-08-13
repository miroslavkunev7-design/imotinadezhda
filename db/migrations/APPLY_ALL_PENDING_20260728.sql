-- =====================================================================
-- APPLY THIS FILE IN SUPABASE SQL EDITOR (Run once).
-- Combines all pending migrations. Safe: IF NOT EXISTS everywhere.
-- Generated 2026-07-28
-- =====================================================================

-- ---------- db/migrations/20260713120000_rentals_and_payments.sql ----------
-- Rentals module: track leased properties + monthly rent payments with attached documents.
-- Apply with: `supabase db push` (or paste into Supabase SQL Editor).

CREATE TABLE IF NOT EXISTS public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  landlord_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  quarter_id UUID REFERENCES public.quarters(id) ON DELETE SET NULL,
  address TEXT,
  tenant_name TEXT,
  tenant_phone TEXT,
  landlord_name TEXT,
  landlord_phone TEXT,
  start_date DATE,
  end_date DATE,
  monthly_rent NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_day INTEGER,
  deposit NUMERIC(12,2),
  inventory TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rentals TO authenticated;
GRANT ALL ON public.rentals TO service_role;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rentals admin all" ON public.rentals;
CREATE POLICY "rentals admin all" ON public.rentals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_rentals_tenant ON public.rentals(tenant_client_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON public.rentals(status);

CREATE TABLE IF NOT EXISTS public.rental_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  period_month DATE NOT NULL, -- first day of the billed month
  due_date DATE,
  paid_date DATE,
  amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'paid' | 'unpaid' | 'late' | 'partial'
  document_url TEXT,
  document_name TEXT,
  document_mime TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rental_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_payments TO authenticated;
GRANT ALL ON public.rental_payments TO service_role;
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rental_payments admin all" ON public.rental_payments;
CREATE POLICY "rental_payments admin all" ON public.rental_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_rental_payments_rental ON public.rental_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_period ON public.rental_payments(period_month);

-- Private storage bucket for rent payment receipts / contract photos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('rental-documents', 'rental-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "rental_docs admin read" ON storage.objects;
CREATE POLICY "rental_docs admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rental-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "rental_docs admin write" ON storage.objects;
CREATE POLICY "rental_docs admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rental-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "rental_docs admin update" ON storage.objects;
CREATE POLICY "rental_docs admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'rental-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "rental_docs admin delete" ON storage.objects;
CREATE POLICY "rental_docs admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rental-documents' AND public.has_role(auth.uid(), 'admin'::app_role));
-- ---------- db/migrations/20260713130000_rentals_management_fee.sql ----------
-- Add monthly management fee (our commission) to rentals.
-- Net to landlord = monthly_rent - management_fee.

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS management_fee NUMERIC(12,2) DEFAULT 0;
-- ---------- db/migrations/20260715120000_missing_tables.sql ----------
-- Missing tables reported by admin.schema page: tasks, contracts, audit_log.
-- Apply in Supabase SQL Editor (idempotent).

-- ============ tasks ============
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks admin all" ON public.tasks;
CREATE POLICY "tasks admin all" ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- ============ contracts ============
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  signed_at TIMESTAMPTZ,
  document_url TEXT,
  document_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contracts admin all" ON public.contracts;
CREATE POLICY "contracts admin all" ON public.contracts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON public.contracts(type);

-- ============ audit_log ============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log admin read" ON public.audit_log;
CREATE POLICY "audit_log admin read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "audit_log auth insert" ON public.audit_log;
CREATE POLICY "audit_log auth insert" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

NOTIFY pgrst, 'reload schema';

-- ---------- db/migrations/20260721120000_core_missing_tables.sql ----------
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
-- ---------- db/migrations/20260725120000_ai_chat_sessions.sql ----------
-- AI chat sessions & messages (idempotent).
-- Stores per-user AI assistant conversation history so brokers can resume
-- a chat weeks later and the assistant retains full context.

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Нов разговор',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx
  ON public.ai_conversations(user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conversations_owner_select ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_select ON public.ai_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_conversations_owner_insert ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_insert ON public.ai_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_conversations_owner_update ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_update ON public.ai_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_conversations_owner_delete ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_delete ON public.ai_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx
  ON public.ai_messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_messages_owner_select ON public.ai_messages;
CREATE POLICY ai_messages_owner_select ON public.ai_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_messages_owner_insert ON public.ai_messages;
CREATE POLICY ai_messages_owner_insert ON public.ai_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS ai_messages_owner_delete ON public.ai_messages;
CREATE POLICY ai_messages_owner_delete ON public.ai_messages
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';