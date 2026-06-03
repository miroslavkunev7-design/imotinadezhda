
-- Public read for broker-photos (bucket is public; align RLS policy with intent)
DROP POLICY IF EXISTS "broker-photos public read" ON storage.objects;
CREATE POLICY "broker-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'broker-photos');

-- Public read for page-backgrounds (table is publicly readable and references URLs in this bucket)
DROP POLICY IF EXISTS "page-backgrounds public read" ON storage.objects;
CREATE POLICY "page-backgrounds public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'page-backgrounds');
