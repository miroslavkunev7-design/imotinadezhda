-- Security: broker emails must not be readable by anonymous visitors.
-- Nothing on the public site reads the brokers table (only admin pages and
-- server functions, which use authenticated/service clients), so the anon
-- SELECT policy is removed entirely.

DROP POLICY IF EXISTS "brokers public read active" ON public.brokers;
REVOKE SELECT ON public.brokers FROM anon;
