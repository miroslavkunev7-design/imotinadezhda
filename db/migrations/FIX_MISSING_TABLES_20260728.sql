-- =====================================================================
-- FIX: create the 5 tables still missing in Supabase (checked 2026-07-28).
-- Missing: rentals, rental_payments, tasks, contracts, audit_log
-- Requires existing public.has_role(uuid, app_role) -- verified present.
-- Idempotent: safe to run once or many times. Run in Supabase SQL Editor.
-- =====================================================================


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


NOTIFY pgrst, 'reload schema';
