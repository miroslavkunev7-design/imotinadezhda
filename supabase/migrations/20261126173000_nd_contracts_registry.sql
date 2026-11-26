-- Регистър на изготвените договори (страница „Договори“ и Тед): връзка договор ↔ клиент ↔ продавач/наемодател ↔ имот.
-- Същият модел като останалите nd_ таблици: id + data jsonb, генерирани колони за връзките, RLS само за екипа.
create table if not exists public.nd_contracts (
  id text primary key default replace((gen_random_uuid())::text, '-'::text, ''::text),
  data jsonb not null default '{}'::jsonb,
  name text generated always as (coalesce(data ->> 'title', data ->> 'name')) stored,
  kind text generated always as (data ->> 'kind') stored,
  client_id text generated always as (nullif(data ->> 'client_id', '')) stored,
  seller_id text generated always as (nullif(data ->> 'seller_id', '')) stored,
  prop_id text generated always as (nullif(data ->> 'prop_id', '')) stored,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nd_contracts_upd_idx on public.nd_contracts (updated_at desc);
create index if not exists nd_contracts_client_idx on public.nd_contracts (client_id);
create index if not exists nd_contracts_seller_idx on public.nd_contracts (seller_id);
create index if not exists nd_contracts_prop_idx on public.nd_contracts (prop_id);
create index if not exists nd_contracts_kind_idx on public.nd_contracts (kind);
alter table public.nd_contracts enable row level security;
drop policy if exists "nd staff all" on public.nd_contracts;
create policy "nd staff all" on public.nd_contracts for all to authenticated using (nd_is_staff()) with check (nd_is_staff());
revoke all on public.nd_contracts from anon;
grant select, insert, update, delete on public.nd_contracts to authenticated;
grant all on public.nd_contracts to service_role;
drop trigger if exists nd_touch on public.nd_contracts;
create trigger nd_touch before update on public.nd_contracts for each row execute function nd_touch();
