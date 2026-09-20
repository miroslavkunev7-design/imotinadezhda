-- ============================================================
-- Автоматизация №18: Маркетинг Автоматизация
-- Управление на реклами, бюджети, разходи и ROI по канали.
-- Безопасна миграция: само IF NOT EXISTS.
-- ============================================================

-- ---------- Маркетинг канали ----------
create table if not exists public.ad_channels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,                        -- facebook|instagram|google|imoti_bg|imot_bg|viber|email
  name text not null,
  is_active boolean not null default true,
  default_cpc numeric(10,2),
  default_cpm numeric(10,2),
  notes text
);

grant select, insert, update, delete on public.ad_channels to authenticated;
grant all on public.ad_channels to service_role;
alter table public.ad_channels enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ad_channels' and policyname='ad_channels_auth_all') then
    create policy ad_channels_auth_all on public.ad_channels for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.ad_channels (code, name, default_cpc, default_cpm) values
  ('facebook', 'Facebook Ads', 0.28, 3.20),
  ('instagram', 'Instagram Ads', 0.31, 3.80),
  ('google', 'Google Ads', 0.45, 5.10),
  ('imoti_bg', 'Imoti.bg (промо)', null, null),
  ('imot_bg', 'Imot.bg (промо)', null, null),
  ('viber', 'Viber кампании', null, null),
  ('email', 'Email маркетинг', null, null)
on conflict (code) do nothing;

-- ---------- Кампании ----------
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  channel_code text not null default 'facebook',
  objective text not null default 'leads',           -- leads|traffic|awareness|listing_promo
  status text not null default 'draft',              -- draft|active|paused|completed|stopped
  property_id uuid,
  city text,
  audience text,
  start_date date,
  end_date date,
  budget_total numeric(12,2) not null default 0,
  budget_daily numeric(12,2),
  currency text not null default 'BGN',
  spent numeric(12,2) not null default 0,
  impressions int not null default 0,
  clicks int not null default 0,
  leads int not null default 0,
  deals int not null default 0,
  revenue numeric(12,2) not null default 0,
  auto_pause_on_budget boolean not null default true,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ai_notes text,
  owner_id uuid,
  notes text
);

create index if not exists ad_campaigns_status_idx on public.ad_campaigns (status, updated_at desc);
create index if not exists ad_campaigns_channel_idx on public.ad_campaigns (channel_code);

grant select, insert, update, delete on public.ad_campaigns to authenticated;
grant all on public.ad_campaigns to service_role;
alter table public.ad_campaigns enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ad_campaigns' and policyname='ad_campaigns_auth_all') then
    create policy ad_campaigns_auth_all on public.ad_campaigns for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Криейтиви (обяви) ----------
create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  variant text not null default 'A',                 -- A|B|C
  headline text,
  body text,
  cta text default 'Виж имота',
  image_url text,
  target_url text,
  ai_used boolean not null default false,
  model text,
  status text not null default 'draft',              -- draft|active|paused|winner|loser
  impressions int not null default 0,
  clicks int not null default 0,
  leads int not null default 0
);

create index if not exists ad_creatives_campaign_idx on public.ad_creatives (campaign_id, variant);

grant select, insert, update, delete on public.ad_creatives to authenticated;
grant all on public.ad_creatives to service_role;
alter table public.ad_creatives enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ad_creatives' and policyname='ad_creatives_auth_all') then
    create policy ad_creatives_auth_all on public.ad_creatives for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Дневни резултати / разходи ----------
create table if not exists public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  creative_id uuid,
  day date not null default current_date,
  spend numeric(12,2) not null default 0,
  impressions int not null default 0,
  clicks int not null default 0,
  leads int not null default 0,
  source text default 'manual',                      -- manual|import|api
  notes text,
  unique (campaign_id, creative_id, day)
);

create index if not exists ad_spend_day_idx on public.ad_spend (day desc);

grant select, insert, update, delete on public.ad_spend to authenticated;
grant all on public.ad_spend to service_role;
alter table public.ad_spend enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ad_spend' and policyname='ad_spend_auth_all') then
    create policy ad_spend_auth_all on public.ad_spend for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Бюджети по периоди ----------
create table if not exists public.ad_budgets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  period_month date not null,                        -- първи ден на месеца
  channel_code text,
  campaign_id uuid,
  planned numeric(12,2) not null default 0,
  actual numeric(12,2) not null default 0,
  currency text not null default 'BGN',
  notes text,
  unique (period_month, channel_code, campaign_id)
);

grant select, insert, update, delete on public.ad_budgets to authenticated;
grant all on public.ad_budgets to service_role;
alter table public.ad_budgets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ad_budgets' and policyname='ad_budgets_auth_all') then
    create policy ad_budgets_auth_all on public.ad_budgets for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Атрибуция на лийдове ----------
create table if not exists public.ad_attributions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campaign_id uuid,
  creative_id uuid,
  lead_id uuid,
  deal_id uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_url text,
  revenue numeric(12,2),
  status text not null default 'lead'                -- lead|qualified|won|lost
);

create index if not exists ad_attributions_campaign_idx on public.ad_attributions (campaign_id, created_at desc);

grant select, insert, update, delete on public.ad_attributions to authenticated;
grant all on public.ad_attributions to service_role;
alter table public.ad_attributions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ad_attributions' and policyname='ad_attributions_auth_all') then
    create policy ad_attributions_auth_all on public.ad_attributions for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Журнал ----------
create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campaign_id uuid,
  event_type text not null,                          -- created|status|spend|budget_alert|auto_pause|ai_creative|sweep|error
  status text not null default 'ok',
  message text,
  payload jsonb not null default '{}'::jsonb,
  actor text
);

create index if not exists ad_events_time_idx on public.ad_events (created_at desc);

grant select, insert on public.ad_events to authenticated;
grant all on public.ad_events to service_role;
alter table public.ad_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ad_events' and policyname='ad_events_auth_all') then
    create policy ad_events_auth_all on public.ad_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки и задача ----------
insert into public.automation_settings (key, value)
values ('marketing', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'default_currency', 'BGN',
  'monthly_budget', 3000,
  'budget_alert_percent', 80,
  'auto_pause_on_budget', true,
  'target_cpl', 25,
  'max_cpl', 60,
  'auto_pause_bad_cpl', false
))
on conflict (key) do nothing;

insert into public.automation_jobs (key)
values ('marketing_sweep')
on conflict (key) do nothing;
