CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  checksum text
);
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.schema_migrations TO service_role;

CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  execute query;
end;
$$;

REVOKE ALL ON FUNCTION public.exec_sql(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;