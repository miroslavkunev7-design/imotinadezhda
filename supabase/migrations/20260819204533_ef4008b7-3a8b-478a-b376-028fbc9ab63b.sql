ALTER TABLE public.deal_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deal_counters FROM anon, authenticated;
GRANT ALL ON public.deal_counters TO service_role;