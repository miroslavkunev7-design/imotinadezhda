DROP POLICY IF EXISTS "mortgage-docs anyone upload" ON storage.objects;
CREATE POLICY "mortgage-docs uuid-folder upload" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'mortgage-docs'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );