revoke all on table public.schema_migrations from anon, authenticated;
grant all on table public.schema_migrations to service_role;
revoke all on function public.exec_sql(text) from public, anon, authenticated;
grant execute on function public.exec_sql(text) to service_role;