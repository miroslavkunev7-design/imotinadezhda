-- Персонални (и глобални) настройки на всяка CRM страница:
-- цветове, шрифтове, фон, подредба/размер/скриване на блокове и добавени блокчета.

create table if not exists public.crm_page_customizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  page_key text not null,
  scope text not null default 'user' check (scope in ('user', 'global')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_page_customizations_scope_user_ck
    check ((scope = 'user' and user_id is not null) or (scope = 'global' and user_id is null))
);

create unique index if not exists crm_page_customizations_user_page_uq
  on public.crm_page_customizations (user_id, page_key)
  where scope = 'user';

create unique index if not exists crm_page_customizations_global_page_uq
  on public.crm_page_customizations (page_key)
  where scope = 'global';

grant select, insert, update, delete on public.crm_page_customizations to authenticated;
grant all on public.crm_page_customizations to service_role;

alter table public.crm_page_customizations enable row level security;

drop policy if exists "own settings select" on public.crm_page_customizations;
create policy "own settings select"
on public.crm_page_customizations
for select
to authenticated
using (scope = 'global' or user_id = auth.uid());

drop policy if exists "own settings insert" on public.crm_page_customizations;
create policy "own settings insert"
on public.crm_page_customizations
for insert
to authenticated
with check (
  (scope = 'user' and user_id = auth.uid())
  or (scope = 'global' and public.has_role(auth.uid(), 'admin'))
);

drop policy if exists "own settings update" on public.crm_page_customizations;
create policy "own settings update"
on public.crm_page_customizations
for update
to authenticated
using (
  (scope = 'user' and user_id = auth.uid())
  or (scope = 'global' and public.has_role(auth.uid(), 'admin'))
)
with check (
  (scope = 'user' and user_id = auth.uid())
  or (scope = 'global' and public.has_role(auth.uid(), 'admin'))
);

drop policy if exists "own settings delete" on public.crm_page_customizations;
create policy "own settings delete"
on public.crm_page_customizations
for delete
to authenticated
using (
  (scope = 'user' and user_id = auth.uid())
  or (scope = 'global' and public.has_role(auth.uid(), 'admin'))
);

drop trigger if exists set_crm_page_customizations_updated_at on public.crm_page_customizations;
create trigger set_crm_page_customizations_updated_at
before update on public.crm_page_customizations
for each row execute function public.set_updated_at();
