-- ============================================================
-- AI Document Ingest: extend client_documents + storage policies
-- + RPC find_or_create_client for AI-driven imports
--
-- HOW TO APPLY: Paste the whole file in Supabase Dashboard →
-- SQL Editor → Run. Idempotent (uses IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================

-- 1) Extend client_documents with organized metadata
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS category         TEXT,
  ADD COLUMN IF NOT EXISTS period_month     SMALLINT,
  ADD COLUMN IF NOT EXISTS period_year      SMALLINT,
  ADD COLUMN IF NOT EXISTS period_day       SMALLINT,
  ADD COLUMN IF NOT EXISTS storage_path     TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence    NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS ai_metadata      JSONB,
  ADD COLUMN IF NOT EXISTS source_batch_id  UUID;

DO $$ BEGIN
  ALTER TABLE public.client_documents
    ADD CONSTRAINT client_documents_period_month_chk
    CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.client_documents
    ADD CONSTRAINT client_documents_period_year_chk
    CHECK (period_year IS NULL OR period_year BETWEEN 2000 AND 2100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.client_documents
    ADD CONSTRAINT client_documents_period_day_chk
    CHECK (period_day IS NULL OR period_day BETWEEN 1 AND 31);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_client_documents_client_cat
  ON public.client_documents (client_id, category, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_client_documents_batch
  ON public.client_documents (source_batch_id);

-- 2) Storage policies for the existing client-documents bucket.
-- Path convention: {client_id}/{category}/... or temp/{batch}/...
-- Full-access CRM users can manage everything; anyone signed in may write
-- to temp/ during a batch (files are moved once approved).
DROP POLICY IF EXISTS "client-documents read"   ON storage.objects;
DROP POLICY IF EXISTS "client-documents insert" ON storage.objects;
DROP POLICY IF EXISTS "client-documents update" ON storage.objects;
DROP POLICY IF EXISTS "client-documents delete" ON storage.objects;

CREATE POLICY "client-documents read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-documents'
  AND (
    public.is_full_access(auth.uid())
    OR split_part(name, '/', 1) = 'temp'
  )
);

CREATE POLICY "client-documents insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-documents'
  AND (
    public.is_full_access(auth.uid())
    OR split_part(name, '/', 1) = 'temp'
  )
);

CREATE POLICY "client-documents update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-documents' AND public.is_full_access(auth.uid()))
WITH CHECK (bucket_id = 'client-documents' AND public.is_full_access(auth.uid()));

CREATE POLICY "client-documents delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-documents' AND public.is_full_access(auth.uid()));

-- 3) RPC: fuzzy find-or-create client by name.
CREATE OR REPLACE FUNCTION public.find_or_create_client_by_name(
  _name TEXT,
  _created_by UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid   UUID;
  clean TEXT := lower(btrim(_name));
BEGIN
  IF clean IS NULL OR length(clean) = 0 THEN
    RAISE EXCEPTION 'client name required';
  END IF;

  SELECT id INTO cid
  FROM public.clients
  WHERE lower(btrim(full_name)) = clean
  ORDER BY created_at DESC
  LIMIT 1;

  IF cid IS NULL THEN
    INSERT INTO public.clients (full_name, client_type, status, created_by)
    VALUES (btrim(_name), 'buyer', 'active', _created_by)
    RETURNING id INTO cid;
  END IF;

  RETURN cid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_client_by_name(TEXT, UUID) TO authenticated;