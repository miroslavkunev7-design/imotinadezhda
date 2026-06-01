
-- Storage bucket за документи към имотите (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-documents', 'property-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: само админи виждат и качват
CREATE POLICY "property_documents admin read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'property-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "property_documents admin write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'property-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "property_documents admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'property-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "property_documents admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'property-documents' AND has_role(auth.uid(), 'admin'::app_role));

-- Таблица за документи към имот
CREATE TABLE public.property_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('skica','tax_assessment','encumbrance_check','other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_documents TO authenticated;
GRANT ALL ON public.property_documents TO service_role;

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_documents admin all"
ON public.property_documents FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_property_documents_property ON public.property_documents(property_id);
