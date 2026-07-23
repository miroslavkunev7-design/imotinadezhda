
DROP POLICY IF EXISTS "Authenticated can read agency settings" ON public.agency_settings;
CREATE POLICY "Admins can read agency settings"
  ON public.agency_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "mortgage-docs admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'mortgage-docs' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'mortgage-docs' AND has_role(auth.uid(), 'admin'::app_role));
