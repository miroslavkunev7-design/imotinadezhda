DROP POLICY IF EXISTS "mortgage-docs uuid-folder upload" ON storage.objects;
DROP POLICY IF EXISTS "mortgage-docs anyone upload" ON storage.objects;
DROP POLICY IF EXISTS "mortgage-docs admin upload" ON storage.objects;
CREATE POLICY "mortgage-docs admin upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mortgage-docs' AND public.has_role(auth.uid(), 'admin'::public.app_role));