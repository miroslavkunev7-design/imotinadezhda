
-- ============ CLIENTS ============
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  client_type TEXT NOT NULL DEFAULT 'buyer',
  status TEXT NOT NULL DEFAULT 'active',
  search_city_id UUID,
  search_quarter_id UUID,
  search_property_type TEXT,
  search_status TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  currency TEXT DEFAULT 'EUR',
  rooms_min INTEGER,
  rooms_max INTEGER,
  area_min NUMERIC,
  area_max NUMERIC,
  notes TEXT,
  assigned_broker_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients admin all" ON public.clients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "clients broker assigned" ON public.clients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'broker'::app_role) AND assigned_broker_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'broker'::app_role) AND assigned_broker_id = auth.uid());
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CLIENT DOCUMENTS ============
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_documents admin all" ON public.client_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ BROKERS ============
CREATE TABLE IF NOT EXISTS public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  photo_url TEXT,
  license_number TEXT,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  properties_count INTEGER DEFAULT 0,
  clients_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brokers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brokers TO authenticated;
GRANT ALL ON public.brokers TO service_role;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brokers public read active" ON public.brokers FOR SELECT USING (is_active = true);
CREATE POLICY "brokers admin all" ON public.brokers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "brokers self update" ON public.brokers FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER brokers_updated_at BEFORE UPDATE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PROPERTY MATCHES ============
CREATE TABLE IF NOT EXISTS public.property_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL,
  client_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  match_reasons JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  notified BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_matches TO authenticated;
GRANT ALL ON public.property_matches TO service_role;
ALTER TABLE public.property_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "property_matches admin all" ON public.property_matches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER property_matches_updated_at BEFORE UPDATE ON public.property_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CONTRACT TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contract_templates admin all" ON public.contract_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER contract_templates_updated_at BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GENERATED CONTRACTS ============
CREATE TABLE IF NOT EXISTS public.generated_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID,
  client_id UUID,
  property_id UUID,
  contract_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_contracts TO authenticated;
GRANT ALL ON public.generated_contracts TO service_role;
ALTER TABLE public.generated_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generated_contracts admin all" ON public.generated_contracts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER generated_contracts_updated_at BEFORE UPDATE ON public.generated_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('broker-photos', 'broker-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client docs admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "client docs admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "client docs admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "broker photos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'broker-photos');
CREATE POLICY "broker photos admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'broker-photos' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "broker photos admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'broker-photos' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "broker photos admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'broker-photos' AND has_role(auth.uid(), 'admin'::app_role));
