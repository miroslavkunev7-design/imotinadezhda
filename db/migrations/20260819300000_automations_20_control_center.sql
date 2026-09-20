-- ============================================================
-- Автоматизация №20: Контролен Център и Анализи
-- KPI, приходи, сделки, брокери — снимки на данните и цели.
-- Безопасна миграция: само IF NOT EXISTS.
-- ============================================================

-- ---------- Дневни снимки на KPI ----------
create table if not exists public.kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  snapshot_date date not null,
  scope text not null default 'agency',            -- agency|broker|city
  scope_ref text,
  leads int not null default 0,
  qualified int not null default 0,
  viewings int not null default 0,
  deals_open int not null default 0,
  deals_won int not null default 0,
  revenue numeric(14,2) not null default 0,
  commission numeric(14,2) not null default 0,
  ad_spend numeric(14,2) not null default 0,
  properties_active int not null default 0,
  new_listings int not null default 0,
  seller_prospects int not null default 0,
  conversion numeric(6,2) not null default 0,
  cpl numeric(12,2) not null default 0,
  roi numeric(8,2) not null default 0,
  currency text not null default 'EUR',
  payload jsonb not null default '{}'::jsonb,
  unique (snapshot_date, scope, scope_ref)
);

create index if not exists kpi_snapshots_date_idx on public.kpi_snapshots (snapshot_date desc, scope);

grant select, insert, update, delete on public.kpi_snapshots to authenticated;
grant all on public.kpi_snapshots to service_role;
alter table public.kpi_snapshots enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='kpi_snapshots' and policyname='kpi_snapshots_auth_all') then
    create policy kpi_snapshots_auth_all on public.kpi_snapshots for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Цели (targets) ----------
create table if not exists public.kpi_targets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metric text not null,                            -- leads|deals_won|revenue|commission|viewings|new_listings|conversion
  period text not null default 'month',            -- month|quarter|year
  period_start date not null,
  scope text not null default 'agency',            -- agency|broker
  scope_ref text,
  target numeric(14,2) not null default 0,
  label text,
  unique (metric, period, period_start, scope, scope_ref)
);

grant select, insert, update, delete on public.kpi_targets to authenticated;
grant all on public.kpi_targets to service_role;
alter table public.kpi_targets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='kpi_targets' and policyname='kpi_targets_auth_all') then
    create policy kpi_targets_auth_all on public.kpi_targets for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- AI обобщения / брифинги ----------
create table if not exists public.kpi_briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_label text not null,
  summary text not null,
  highlights jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  actor text
);

create index if not exists kpi_briefings_time_idx on public.kpi_briefings (created_at desc);

grant select, insert, delete on public.kpi_briefings to authenticated;
grant all on public.kpi_briefings to service_role;
alter table public.kpi_briefings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='kpi_briefings' and policyname='kpi_briefings_auth_all') then
    create policy kpi_briefings_auth_all on public.kpi_briefings for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Журнал ----------
create table if not exists public.kpi_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,                        -- snapshot|target|ai_briefing|alert|error
  status text not null default 'ok',
  message text,
  payload jsonb not null default '{}'::jsonb,
  actor text
);

create index if not exists kpi_events_time_idx on public.kpi_events (created_at desc);

grant select, insert on public.kpi_events to authenticated;
grant all on public.kpi_events to service_role;
alter table public.kpi_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='kpi_events' and policyname='kpi_events_auth_all') then
    create policy kpi_events_auth_all on public.kpi_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки и задача ----------
insert into public.automation_settings (key, value)
values ('control_center', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'currency', 'EUR',
  'snapshot_days', 90,
  'target_conversion', 12,
  'alert_low_leads', 5,
  'lease_seconds', 300
))
on conflict (key) do nothing;

insert into public.automation_jobs (key)
values ('control_center_snapshot')
on conflict (key) do nothing;
