-- ============================================================
-- Автоматизация №17: Изчисляване на Комисионни
-- Автоматично пресмятане по правила, разпределение между брокери,
-- изплащания и отчети. Безопасна миграция: само IF NOT EXISTS.
-- ============================================================

-- ---------- Правила за комисионни ----------
create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  deal_type text not null default 'sale',            -- sale | rent | any
  basis text not null default 'percent',             -- percent | fixed | rent_months
  percent numeric(6,3) default 3,
  fixed_amount numeric(14,2),
  rent_months numeric(6,2),
  min_amount numeric(14,2) default 0,
  max_amount numeric(14,2),
  broker_share_percent numeric(6,3) not null default 50,   -- дял на брокера от комисионната
  agency_share_percent numeric(6,3) not null default 50,
  vat_percent numeric(6,3) not null default 20,
  vat_included boolean not null default false,
  price_from numeric(14,2),
  price_to numeric(14,2),
  priority int not null default 100,
  is_active boolean not null default true,
  notes text
);

grant select, insert, update, delete on public.commission_rules to authenticated;
grant all on public.commission_rules to service_role;
alter table public.commission_rules enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commission_rules' and policyname='commission_rules_auth_all') then
    create policy commission_rules_auth_all on public.commission_rules for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.commission_rules (code, name, deal_type, basis, percent, rent_months, min_amount, broker_share_percent, agency_share_percent, price_from, price_to, priority) values
  ('sale_standard', 'Продажба — стандарт 3%', 'sale', 'percent', 3, null, 1500, 50, 50, null, 150000, 100),
  ('sale_premium', 'Продажба над 150 000 € — 2.5%', 'sale', 'percent', 2.5, null, 3000, 55, 45, 150000, null, 90),
  ('rent_standard', 'Наем — един месечен наем', 'rent', 'rent_months', null, 1, 200, 60, 40, null, null, 100)
on conflict (code) do nothing;

-- ---------- Комисионни по сделка ----------
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deal_id uuid references public.deals(id) on delete cascade,
  rule_code text,
  deal_type text not null default 'sale',
  currency text not null default 'EUR',
  base_amount numeric(14,2) not null default 0,      -- договорена цена / наем
  percent numeric(6,3),
  gross_amount numeric(14,2) not null default 0,     -- комисионна без ДДС
  vat_percent numeric(6,3) not null default 20,
  vat_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,     -- с ДДС
  broker_amount numeric(14,2) not null default 0,
  agency_amount numeric(14,2) not null default 0,
  broker_id uuid references public.brokers(id) on delete set null,
  status text not null default 'calculated',          -- draft|calculated|approved|invoiced|paid|cancelled
  approved_at timestamptz,
  approved_by text,
  invoice_number text,
  invoiced_at timestamptz,
  paid_at timestamptz,
  paid_amount numeric(14,2) not null default 0,
  payment_method text,
  period_month date,                                  -- за отчети (първо число на месеца)
  ai_summary text,
  ai_updated_at timestamptz,
  calc_note text,
  notes text,
  created_by text,
  unique (deal_id)
);

create index if not exists commissions_status_idx on public.commissions (status, created_at desc);
create index if not exists commissions_period_idx on public.commissions (period_month);
create index if not exists commissions_broker_idx on public.commissions (broker_id);

grant select, insert, update, delete on public.commissions to authenticated;
grant all on public.commissions to service_role;
alter table public.commissions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commissions' and policyname='commissions_auth_all') then
    create policy commissions_auth_all on public.commissions for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Разпределение между участници ----------
create table if not exists public.commission_splits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  commission_id uuid references public.commissions(id) on delete cascade,
  broker_id uuid references public.brokers(id) on delete set null,
  role text not null default 'broker',                -- broker|co_broker|referral|agency
  name text,
  share_percent numeric(6,3) not null default 0,
  amount numeric(14,2) not null default 0,
  status text not null default 'pending',             -- pending|approved|paid
  paid_at timestamptz,
  note text
);

create index if not exists commission_splits_commission_idx on public.commission_splits (commission_id);

grant select, insert, update, delete on public.commission_splits to authenticated;
grant all on public.commission_splits to service_role;
alter table public.commission_splits enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commission_splits' and policyname='commission_splits_auth_all') then
    create policy commission_splits_auth_all on public.commission_splits for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Изплащания ----------
create table if not exists public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  commission_id uuid references public.commissions(id) on delete cascade,
  split_id uuid references public.commission_splits(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  amount numeric(14,2) not null default 0,
  currency text not null default 'EUR',
  method text not null default 'bank',                -- bank|cash|other
  reference text,
  paid_at timestamptz not null default now(),
  period_month date,
  note text,
  created_by text
);

create index if not exists commission_payouts_period_idx on public.commission_payouts (period_month);

grant select, insert, update, delete on public.commission_payouts to authenticated;
grant all on public.commission_payouts to service_role;
alter table public.commission_payouts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commission_payouts' and policyname='commission_payouts_auth_all') then
    create policy commission_payouts_auth_all on public.commission_payouts for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Журнал ----------
create table if not exists public.commission_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  commission_id uuid,
  deal_id uuid,
  action text not null,
  status text not null default 'ok',
  message text,
  actor text
);

create index if not exists commission_events_time_idx on public.commission_events (created_at desc);

grant select, insert, update, delete on public.commission_events to authenticated;
grant all on public.commission_events to service_role;
alter table public.commission_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commission_events' and policyname='commission_events_auth_all') then
    create policy commission_events_auth_all on public.commission_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки и задача ----------
insert into public.automation_settings (key, value)
values ('commissions', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'auto_calculate_won_deals', true,
  'auto_approve', false,
  'default_currency', 'EUR',
  'default_vat_percent', 20,
  'vat_registered', true,
  'batch_size', 25,
  'lease_seconds', 300,
  'invoice_prefix', 'КОМ',
  'invoice_start', 1
))
on conflict (key) do nothing;

insert into public.automation_jobs (key)
values ('commissions_sweep')
on conflict (key) do nothing;