DROP POLICY IF EXISTS "brokers public read active" ON public.brokers;
REVOKE SELECT ON public.brokers FROM anon;