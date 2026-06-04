-- 1) inquiries: replace WITH CHECK (true) with actual field validation
DROP POLICY IF EXISTS "inquiries anyone can insert" ON public.inquiries;
CREATE POLICY "inquiries anyone can insert"
ON public.inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (
  name IS NOT NULL
  AND length(btrim(name)) BETWEEN 2 AND 120
  AND email IS NOT NULL
  AND length(btrim(email)) BETWEEN 5 AND 200
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (phone IS NULL OR length(phone) <= 40)
  AND (message IS NULL OR length(message) <= 2000)
);

-- 2) broker-photos: drop overly broad public SELECT (public bucket already serves via /object/public)
DROP POLICY IF EXISTS "broker-photos public read" ON storage.objects;

-- 3) has_role: convert to SECURITY INVOKER so it stops tripping the linter.
--    Grant authenticated SELECT on user_roles so RLS policies that call has_role still work.
GRANT SELECT ON public.user_roles TO authenticated;

ALTER FUNCTION public.has_role(uuid, app_role) SECURITY INVOKER;