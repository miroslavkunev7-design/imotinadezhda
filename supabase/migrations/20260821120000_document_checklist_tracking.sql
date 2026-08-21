-- Automation №9: document tracking (files + deal checklist).
-- RLS: deny anon; CRM staff via authenticated policies; service_role bypasses RLS.

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid;

ALTER TABLE public.property_documents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS notes text;

DO $$ BEGIN
  ALTER TABLE public.client_documents
    ADD CONSTRAINT client_documents_track_status_chk
    CHECK (status IN ('uploaded', 'verified', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.property_documents
    ADD CONSTRAINT property_documents_track_status_chk
    CHECK (status IN ('uploaded', 'verified', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_client_documents_status
  ON public.client_documents (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_property_documents_status
  ON public.property_documents (status, expires_at);

CREATE TABLE IF NOT EXISTS public.document_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  archived_property_id uuid REFERENCES public.archived_properties(id) ON DELETE SET NULL,
  doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'missing',
  file_source text,
  file_id uuid,
  file_url text,
  file_name text,
  expires_at date,
  requested_at timestamptz,
  uploaded_at timestamptz,
  uploaded_by uuid,
  verified_at timestamptz,
  verified_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_checklist_status_chk
    CHECK (status IN ('missing', 'requested', 'uploaded', 'verified', 'expired')),
  CONSTRAINT document_checklist_subject_chk
    CHECK (client_id IS NOT NULL OR property_id IS NOT NULL OR archived_property_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS document_checklist_unique_slot
  ON public.document_checklist (
    COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(archived_property_id, '00000000-0000-0000-0000-000000000000'::uuid),
    doc_type
  );

CREATE INDEX IF NOT EXISTS idx_document_checklist_client
  ON public.document_checklist (client_id);
CREATE INDEX IF NOT EXISTS idx_document_checklist_property
  ON public.document_checklist (property_id);
CREATE INDEX IF NOT EXISTS idx_document_checklist_status
  ON public.document_checklist (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_document_checklist_type
  ON public.document_checklist (doc_type);

DROP TRIGGER IF EXISTS document_checklist_updated_at ON public.document_checklist;
CREATE TRIGGER document_checklist_updated_at
  BEFORE UPDATE ON public.document_checklist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON public.document_checklist FROM PUBLIC;
REVOKE ALL ON public.document_checklist FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_checklist TO authenticated;
GRANT ALL ON public.document_checklist TO service_role;

ALTER TABLE public.document_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_checklist crm staff" ON public.document_checklist;
CREATE POLICY "document_checklist crm staff"
ON public.document_checklist FOR ALL TO authenticated
USING (
  public.is_full_access(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'boss'::app_role)
  OR public.has_role(auth.uid(), 'head_broker'::app_role)
  OR public.has_role(auth.uid(), 'secretary'::app_role)
  OR public.has_role(auth.uid(), 'broker'::app_role)
  OR public.has_role(auth.uid(), 'consultant'::app_role)
  OR public.has_role(auth.uid(), 'rental_dept'::app_role)
  OR public.has_role(auth.uid(), 'agent'::app_role)
)
WITH CHECK (
  public.is_full_access(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'boss'::app_role)
  OR public.has_role(auth.uid(), 'head_broker'::app_role)
  OR public.has_role(auth.uid(), 'secretary'::app_role)
  OR public.has_role(auth.uid(), 'broker'::app_role)
  OR public.has_role(auth.uid(), 'consultant'::app_role)
  OR public.has_role(auth.uid(), 'rental_dept'::app_role)
  OR public.has_role(auth.uid(), 'agent'::app_role)
);
