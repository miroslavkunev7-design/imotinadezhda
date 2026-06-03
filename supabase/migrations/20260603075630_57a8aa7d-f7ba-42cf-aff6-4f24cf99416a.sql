-- 1. Brokers: replace broad authenticated SELECT with admin + self only
DROP POLICY IF EXISTS "brokers authenticated read active" ON public.brokers;

CREATE POLICY "brokers self read"
ON public.brokers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Public-safe view (no email/phone/license_number)
CREATE OR REPLACE VIEW public.brokers_public
WITH (security_invoker = on) AS
SELECT
  id,
  full_name,
  photo_url,
  bio,
  is_active,
  properties_count,
  clients_count,
  created_at,
  updated_at
FROM public.brokers
WHERE is_active = true;

GRANT SELECT ON public.brokers_public TO anon, authenticated;

-- 2. Storage policies for client-documents (admin manage)
CREATE POLICY "client-documents admin read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "client-documents admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'client-documents' AND public.has_role(auth.uid(), 'admin'));

-- 3. Storage policies for page-backgrounds (admin manage)
CREATE POLICY "page-backgrounds admin read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'page-backgrounds' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "page-backgrounds admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'page-backgrounds' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'page-backgrounds' AND public.has_role(auth.uid(), 'admin'));