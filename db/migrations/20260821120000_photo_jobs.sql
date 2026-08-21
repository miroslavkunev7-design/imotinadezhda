-- AI photo processing jobs (enhance / HDR / virtual staging).
-- Originals are never overwritten; results are stored separately.

CREATE TABLE IF NOT EXISTS public.photo_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  job_type text NOT NULL CHECK (job_type IN ('enhance', 'hdr', 'staging')),
  staging_style text CHECK (staging_style IS NULL OR staging_style IN ('living', 'empty')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  source_url text,
  result_url text,
  result_storage_path text,
  error_message text,
  provider text,
  attached_image_id uuid REFERENCES public.property_images(id) ON DELETE SET NULL,
  prompt text
);

CREATE INDEX IF NOT EXISTS photo_jobs_created_at_idx ON public.photo_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS photo_jobs_property_id_idx ON public.photo_jobs (property_id);
CREATE INDEX IF NOT EXISTS photo_jobs_status_idx ON public.photo_jobs (status);
CREATE INDEX IF NOT EXISTS photo_jobs_job_type_idx ON public.photo_jobs (job_type);

ALTER TABLE public.photo_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM staff manage photo_jobs" ON public.photo_jobs;
CREATE POLICY "CRM staff manage photo_jobs"
ON public.photo_jobs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','boss','head_broker','secretary','broker','consultant','rental_dept','agent')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','boss','head_broker','secretary','broker','consultant','rental_dept','agent')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_jobs TO authenticated;
GRANT ALL ON public.photo_jobs TO service_role;
