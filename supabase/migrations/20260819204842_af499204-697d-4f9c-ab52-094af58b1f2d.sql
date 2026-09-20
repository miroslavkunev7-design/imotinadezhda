create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  checksum text
);
alter table public.schema_migrations enable row level security;
grant all on public.schema_migrations to service_role;

create or replace function public.exec_sql(query text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  execute query;
end;
$$;

revoke all on function public.exec_sql(text) from public, anon, authenticated;
grant execute on function public.exec_sql(text) to service_role;