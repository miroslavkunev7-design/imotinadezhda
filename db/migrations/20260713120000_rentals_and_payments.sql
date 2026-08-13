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