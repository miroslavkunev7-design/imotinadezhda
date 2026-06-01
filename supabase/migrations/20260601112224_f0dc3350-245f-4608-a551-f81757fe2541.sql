
-- 1. Restrict broker public read to safe columns by replacing policy: only authenticated users can read full broker rows; anon gets nothing
DROP POLICY IF EXISTS "brokers public read active" ON public.brokers;
CREATE POLICY "brokers authenticated read active"
ON public.brokers
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. Restrict cross_post_queue to admins only
DROP POLICY IF EXISTS "auth read" ON public.cross_post_queue;
DROP POLICY IF EXISTS "auth update" ON public.cross_post_queue;
DROP POLICY IF EXISTS "auth write" ON public.cross_post_queue;
CREATE POLICY "cross_post_queue admin all"
ON public.cross_post_queue
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Remove admin_access_log from realtime publication (prevents broadcast to all authenticated subscribers)
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_access_log;

-- 4. Revoke EXECUTE on has_role from public roles; RLS evaluation uses definer privileges so this doesn't break policies
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 5. Tighten public bucket SELECT policies so anonymous LIST is not allowed via API.
-- Direct public CDN URLs continue to work because the buckets are marked public:true.
DROP POLICY IF EXISTS "property-images public read" ON storage.objects;
CREATE POLICY "property-images authenticated list"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "broker photos public read" ON storage.objects;
CREATE POLICY "broker photos authenticated list"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'broker-photos');

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars authenticated list"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');
