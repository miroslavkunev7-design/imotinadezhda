-- Restrict listing of objects in public storage buckets to admins only.
-- Public URLs (/storage/v1/object/public/...) still work for viewing files;
-- this only blocks the list/search API which currently lets any authenticated
-- user enumerate all files.

DROP POLICY IF EXISTS "property-images authenticated list" ON storage.objects;
DROP POLICY IF EXISTS "broker photos authenticated list" ON storage.objects;
DROP POLICY IF EXISTS "avatars authenticated list" ON storage.objects;

CREATE POLICY "property-images admin list"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'property-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "broker photos admin list"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'broker-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "avatars own list"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
